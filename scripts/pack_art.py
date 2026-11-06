"""
Packs every game's art into one zip for the home screen's Bulk Upload ("every game"): a folder per game named by its id, each laid
out as that game's own Bulk Upload takes it. The art is the user's own, read from their dumps by each game's portrait script into
data-raw/<game>/art/ (Fates' from public/art and public/skills); the zip is their personal copy and never goes in the repo.
Run:
    python scripts/pack_art.py [output.zip]
The default output is Documents\\FE Games\\FE Roster Art.zip. Pixel-art portraits (the older games, at their native size) are
scaled up by a whole number with no smoothing, so they stay sharp in the app's portrait boxes; skill icons stay as they are.
"""
import io
import os
import sys
import zipfile

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(os.path.expanduser('~'), 'Documents', 'FE Games', 'FE Roster Art.zip')
GAMES = ['fe1', 'fe3', 'fe4', 'fe5', 'fe6', 'fe7', 'fe8', 'fe9', 'fe10', 'fe11', 'fe12', 'fe13', 'fe15', 'fe16', 'fe17']
# A portrait smaller than this on its longer side is pixel art, scaled up to about this size.
PIXEL_ART = 160
TARGET = 256


def scaled(path):
    """The file's bytes, a pixel-art portrait scaled up by a whole number (nearest neighbour)."""
    img = Image.open(path)
    longest = max(img.size)
    if longest >= PIXEL_ART:
        return open(path, 'rb').read()
    k = max(2, round(TARGET / longest))
    buf = io.BytesIO()
    img.resize((img.width * k, img.height * k), Image.NEAREST).save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def fates_files():
    """Fates' art as its Bulk Upload reads it: adults/, children/<id>/base|raw, corrin/<body>/base and hair_raw/, skills/."""
    art = os.path.join(ROOT, 'public', 'art', 'portraits')
    adults = os.path.join(art, 'adults')
    for name in sorted(os.listdir(adults)):
        if name.endswith('.png'):
            yield f'adults/{name}', os.path.join(adults, name), False
    children = os.path.join(art, 'children')
    for child in sorted(os.listdir(children)):
        for layer in ('base.png', 'raw.png'):
            path = os.path.join(children, child, layer)
            if child != 'fe13' and os.path.isfile(path):
                yield f'children/{child}/{layer}', path, False
    corrin = os.path.join(art, 'corrin')
    for body in sorted(os.listdir(corrin)):
        base = os.path.join(corrin, body, 'base.png')
        if os.path.isfile(base):
            yield f'corrin/{body}/base.png', base, False
        hair = os.path.join(corrin, body, 'hair_raw')
        for name in sorted(os.listdir(hair)) if os.path.isdir(hair) else []:
            yield f'corrin/{body}/hair_raw/{name}', os.path.join(hair, name), False
    skills = os.path.join(ROOT, 'public', 'skills')
    for name in sorted(os.listdir(skills)):
        if name.endswith('.png'):
            yield f'skills/{name}', os.path.join(skills, name), False


def game_files(game):
    """A game's data-raw/<game>/art as it is: portraits at the top, skills/, children/ and avatar/ below. Only the top-level
    portraits are scaled; layers must keep their size to line up, and icons stay small."""
    art = os.path.join(ROOT, 'data-raw', game, 'art')
    if not os.path.isdir(art):
        return
    for folder, _, names in os.walk(art):
        for name in sorted(names):
            if not name.endswith('.png'):
                continue
            path = os.path.join(folder, name)
            rel = os.path.relpath(path, art).replace(os.sep, '/')
            yield rel, path, '/' not in rel


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else OUT
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    counts = {}
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        # Fates' folder is named by its number, as the others are (the app still reads one named "fates").
        for game, files in [('fe14', fates_files())] + [(g, game_files(g)) for g in GAMES]:
            n = 0
            for rel, path, portrait in files:
                z.writestr(f'{game}/{rel}', scaled(path) if portrait else open(path, 'rb').read())
                n += 1
            counts[game] = n
    for game, n in counts.items():
        print(f'{game:6} {n:4} files')
    print(f'{sum(counts.values())} files, {os.path.getsize(out) / 1e6:.1f} MB -> {out}')


if __name__ == '__main__':
    main()
