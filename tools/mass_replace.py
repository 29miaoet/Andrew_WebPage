#!/usr/bin/env python3

"""
This is a python script designed to automate replacement
among a large number of files in the current directory. Usage: 

python path/to/mass_replace.py filetype

It will then prompt you for the string to replace and what 
to replace it with.

Example:

python tools/mass_replace.py *.html

or

python3 tools/mass_replace.py *.html

depending on your operating system.
"""

import os
import re
import sys


FILE_EXTENSION = sys.argv[1]
BLACKLIST = () 

newfiles = []
files = [entry.name for entry in os.scandir() if entry.is_file()]
if FILE_EXTENSION != "." and FILE_EXTENSION != "*":
    for file in files:
        extension = file.split(".")[-1]
        if extension == FILE_EXTENSION and file not in BLACKLIST:
            newfiles.append(file)
else:
    newfiles = files[:]


before = input("Replace what: ")
after = input("Replace with what: ")


for file in newfiles:
    with open(file, "r+") as stream:
        content = stream.read()
        exists = re.search(before, content)
        if not exists:
            print(f"\033[31mContent not found in {file}\033[0m")
        else:
            newcontent = re.sub(before, after, content)
            stream.seek(0)
            stream.truncate()
            stream.write(newcontent)
            print(f"\033[32mWrote file {file}\033[0m")

