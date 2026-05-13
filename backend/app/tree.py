from pathlib import Path

def build_tree(paths):

    tree = {}

    for path in paths:

        current = tree

        for part in Path(path).parts:
            current = current.setdefault(part, {})

    return tree