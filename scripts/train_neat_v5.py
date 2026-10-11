#!/usr/bin/env python3
"""Compatibility entrypoint: train the actual browser simulation, not a Python approximation."""
import os
import sys
from pathlib import Path
os.execvp('node', ['node', str(Path(__file__).with_name('train-race.mjs')), *sys.argv[1:]])
