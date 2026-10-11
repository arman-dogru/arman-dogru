#!/usr/bin/env python3
"""Compatibility entrypoint for validation of the current browser race."""
import os
import sys
from pathlib import Path
os.execvp('node', ['node', str(Path(__file__).with_name('validate-race.mjs')), *sys.argv[1:]])
