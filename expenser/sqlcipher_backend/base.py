"""Django DB engine that swaps stdlib sqlite3 for sqlcipher3 and unlocks the
database with PRAGMA key on every new connection.
"""
import os
from collections.abc import Mapping
from itertools import tee

import sqlcipher3
from django.db.backends.sqlite3 import base as sqlite_base
from django.utils.asyncio import async_unsafe

# Functions Django registers on every sqlite connection (regex, math, etc.).
register_functions = sqlite_base.register_functions
FORMAT_QMARK_REGEX = sqlite_base.FORMAT_QMARK_REGEX


class SQLCipherCursorWrapper(sqlcipher3.Cursor):
    """sqlcipher3-backed copy of django.db.backends.sqlite3.base.SQLiteCursorWrapper.

    Django's wrapper inherits stdlib sqlite3.Cursor, which sqlcipher3 rejects.
    Logic mirrors Django's wrapper but is redefined here so super() resolves
    to sqlcipher3.Cursor, not sqlite3.Cursor.
    """

    def execute(self, query, params=None):
        if params is None:
            return super().execute(query)
        param_names = list(params) if isinstance(params, Mapping) else None
        query = self.convert_query(query, param_names=param_names)
        return super().execute(query, params)

    def executemany(self, query, param_list):
        peekable, param_list = tee(iter(param_list))
        if (params := next(peekable, None)) and isinstance(params, Mapping):
            param_names = list(params)
        else:
            param_names = None
        query = self.convert_query(query, param_names=param_names)
        return super().executemany(query, param_list)

    def convert_query(self, query, *, param_names=None):
        if param_names is None:
            return FORMAT_QMARK_REGEX.sub("?", query).replace("%%", "%")
        return query % {name: f":{name}" for name in param_names}


def _validated_key() -> str:
    key = os.environ.get("SQLCIPHER_KEY")
    if not key:
        raise RuntimeError(
            "SQLCIPHER_KEY env var is not set. The encrypted database "
            "cannot be opened without it."
        )
    # PRAGMA can't be parameterized. Reject keys containing single quotes
    # or backslashes so a malformed env var can't break out of the literal.
    if "'" in key or "\\" in key:
        raise RuntimeError("SQLCIPHER_KEY must not contain ' or \\")
    return key


class DatabaseWrapper(sqlite_base.DatabaseWrapper):
    Database = sqlcipher3

    def create_cursor(self, name=None):
        return self.connection.cursor(factory=SQLCipherCursorWrapper)

    @async_unsafe
    def get_new_connection(self, conn_params):
        # Replicates django.db.backends.sqlite3.base.DatabaseWrapper.get_new_connection
        # but uses sqlcipher3.connect and unlocks before any other PRAGMA runs.
        conn = sqlcipher3.connect(**conn_params)

        # Unlock the database FIRST. Anything else (even PRAGMA foreign_keys)
        # will fail with "file is not a database" on an encrypted file.
        conn.execute(f"PRAGMA key = '{_validated_key()}'")
        # Force a parse of page 1 so a bad key fails here instead of later.
        conn.execute("SELECT count(*) FROM sqlite_master").fetchone()

        register_functions(conn)
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA legacy_alter_table = OFF")
        for init_command in self.init_commands:
            if init_command := init_command.strip():
                conn.execute(init_command)
        return conn
