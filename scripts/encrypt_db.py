"""One-shot: convert the plaintext db.sqlite3 into a SQLCipher-encrypted DB.

Usage:
    SQLCIPHER_KEY=... python3 scripts/encrypt_db.py SOURCE TARGET

The script aborts if TARGET already exists, so it's safe to re-run by accident.
"""
import os
import sys

import sqlcipher3


def main(src: str, dst: str) -> None:
    key = os.environ["SQLCIPHER_KEY"]
    if os.path.exists(dst):
        sys.exit(f"refusing to overwrite existing {dst}")
    if not os.path.exists(src):
        sys.exit(f"source not found: {src}")

    con = sqlcipher3.connect(dst)
    cur = con.cursor()
    # PRAGMA key cannot be parameterized, but the URL-safe base64 token in .env
    # has no quotes/backslashes, so inline-quoting is safe here.
    cur.execute(f"PRAGMA key = '{key}'")
    cur.execute(f"ATTACH DATABASE '{src}' AS plaintext KEY ''")
    cur.execute("SELECT sqlcipher_export('main', 'plaintext')")
    cur.execute("DETACH DATABASE plaintext")
    con.commit()
    con.close()
    print(f"wrote encrypted DB: {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: encrypt_db.py SOURCE TARGET")
    main(sys.argv[1], sys.argv[2])
