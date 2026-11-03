"""
The rest of Awakening's art for the app's Bulk Upload, beside what scripts/fe13_portraits.py makes (which this leaves alone): the DLC
recruits' portraits, the Avatar's plain portraits, and the skill icons. From the user's own cartridge image and DLC dump; the output goes
to data-raw/fe13/art/ (git-ignored) and is never committed.

- The DLC recruits (scripts/fe13_dlc.py): the program picks a unit's face at 0x2ce758 from its appearance (the unit's +0x74, filled from
  the episode's ユニットデータ record at 0x2707cc): the record's +0x13, kept in the appearance's +0x1e bits 3-7, names FID_予約<NN>; with
  none, its +0x12 = 0 marks a SpotPass unit (+0x27 = 2), whose face is FID_配信<name>, the name from OtherData's SpotPass table (after a
  12-byte header, マイユニット, 36 bytes a person: +0 the name, +8 its id) at the record's +8 (0x2bac84). Eldigan is the one recruit made that way (配信エルトシャン, on the cartridge);
  the rest's faces are in their episode's global archive (dlc/<content id>/E0xx_GLB.arc, face/予約<NN>_bu_通常.arc). Each portrait is
  the face's bust-up 通常 texture, the card the game shows on the status screen, written as <name>.png (Pr. Marth as pr_marth.png).
- The Avatar: avatar_m.png and avatar_f.png, as a new game sets them up (the constructor at 0x1ef6b8): Build 02 (青年 for a man, 少女
  for a woman), the face A, Hair 01 (髪0), and the palette's first colour (0x2c8128, #f6f4ef), tinted as fe13_portraits.py tints.
- Skill icons: systems/icon_E.ctpk's skill.tga (256x512, RGBA4), 24x24 icons ten to a row; a skill's is the one at RemovableSkillData
  +0x13. Written as skills/<name>.png.

Run: python scripts/fe13_portraits_extra.py [out folder]
"""
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ctr_formats as F  # noqa: E402
import ctr_texture as T  # noqa: E402
import fe13_code as C  # noqa: E402
import fe13_data as D  # noqa: E402
import fe13_dlc as X  # noqa: E402
from fates_lz import decompress  # noqa: E402
from fe13_bin import Bin, ROMFS  # noqa: E402
from fe13_extract import CART  # noqa: E402
from fe13_portraits import slug, tint  # noqa: E402
from ncch_romfs import RomFS, ncsd_partitions  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data-raw', 'fe13', 'art')
SPOTPASS_SIZE = 36


def texture(arc, label):
    """One texture package of a face archive (the binary format: each label [name, index, size, offset]) as an image."""
    for lo, name in arc.labels:
        if name == label:
            length, start = arc.u32(lo + 8), arc.u32(lo + 12)
            return next(iter(T.ctpk(decompress(arc.d[0x20 + start:0x20 + start + length])).values()))
    raise KeyError(label)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else OUT
    os.makedirs(os.path.join(out, 'skills'), exist_ok=True)
    part = dict((i, o) for i, o, _ in ncsd_partitions(CART))[0]
    rom = RomFS(CART, part)
    files = {p: (off, size) for p, off, size in rom.walk()}

    # Face archives: the cartridge's face/ and each DLC episode's global archive.
    dlc_faces = {}
    for path in sorted(glob.glob(os.path.join(ROMFS, 'dlc', '*', 'E0*_GLB.arc'))):
        b = Bin(open(path, 'rb').read())
        for off, name in b.labels:
            if name.startswith('face/'):
                size, start = b.u32(off + 8), b.u32(off + 12)
                dlc_faces['/' + name] = b.d[0x20 + start:0x20 + start + size]

    def face_arc(name):
        p = '/face/' + name
        if p in dlc_faces:
            return Bin(dlc_faces[p])
        off, size = files[p]
        return Bin(rom.read(off, size))

    fd = Bin(decompress(open(os.path.join(ROMFS, 'face', 'FaceData.bin.lz'), 'rb').read()))
    faces = {name: o for o, name in fd.labels}
    other = Bin(decompress(open(os.path.join(ROMFS, 'data', 'OtherData.bin.lz'), 'rb').read()))
    spotpass = other.at['マイユニット'] + 12  # a 12-byte header (the label マイユニット), then the people

    # The DLC recruits.
    made = 0
    for ep in sorted(glob.glob(os.path.join(ROMFS, 'dlc', 'E0*'))):
        path = os.path.join(ep, 'data', 'OtherData_DLC.bin.lz')
        if not os.path.exists(path):
            continue
        b = Bin(decompress(open(path, 'rb').read()))
        recs = [o for o, n in sorted(b.labels) if n != X.UNIT]
        if not recs or (recs[0] + 4) not in b.ptrs:
            continue  # no unit (E022-E027: copies of a template)
        o = recs[0]
        raw = b.d[0x20 + o:0x20 + o + 0x14]
        text = {}
        for f in glob.glob(os.path.join(ep, 'm', 'E', '*.bin.lz')):
            text.update(X.fates_text.read(f))
        name = text.get(b.str(o + 4))
        if raw[0x13]:
            fid = 'FID_予約%02d' % raw[0x13]
        elif raw[0x12] == 0:
            entry = spotpass + SPOTPASS_SIZE * b.u16(o + 8)
            # The table's record there is the recruit's own: its id (+8) is the key, its name (+0) the record's (+0).
            assert other.u16(entry + 8) == b.u16(o + 8) and other.str(entry) == b.str(o), (ep, other.str(entry), b.str(o))
            fid = 'FID_配信' + other.str(entry)
        else:
            print('no face rule for', os.path.basename(ep), name)
            continue
        face = faces[f'FSID_BU_{fid[4:]}_通常']
        img = texture(face_arc(fd.str(face + 8)), '通常.ctpk.lz')
        img.save(os.path.join(out, f'{slug(name)}.png'))
        print(f'{os.path.basename(ep)} {name}: {fid}')
        made += 1

    # The Avatar as a new game sets them up: Build 02, face A, Hair 01, the palette's first colour.
    builds = C.avatar_builds()
    colour = C.avatar_hair_palette()[0]
    for g, gender in enumerate('mf'):
        arc = face_arc(f'マイユニ_{builds[g * 3 + 1]}_顔立ちA_bu_通常.arc')
        whole = texture(arc, '通常.ctpk.lz').copy()
        whole.alpha_composite(tint(texture(arc, '髪0.ctpk.lz'), colour))
        whole.save(os.path.join(out, f'avatar_{gender}.png'))

    # Skill icons.
    off, size = files['/systems/icon_E.ctpk.lz']
    sheet = F.ctpk(decompress(rom.read(off, size)))['skill.tga']
    gd = D.gamedata()
    dlc_text = X.global_text()
    icons, done = 0, set()
    for k in range(1, gd.u32(gd.at['RemovableSkillDataNum'])):
        r = gd.at['RemovableSkillData'] + 28 * k
        label = gd.str(r + 8)
        name = D.name_of(label) or dlc_text.get(label)
        # The enemies' Luna+, Vantage+, Pavise+ and Aegis+ have icons of their own but the same file name as the skill they improve
        # (the app's names drop the +): the first, the player's, is kept.
        if not name or slug(name) in done:
            continue
        done.add(slug(name))
        i = gd.u8(r + 0x13)
        x, y = (i % 10) * 24, (i // 10) * 24
        sheet.crop((x, y, x + 24, y + 24)).save(os.path.join(out, 'skills', f'{slug(name)}.png'))
        icons += 1
    print(f"{made} DLC portraits, the Avatar's 2, {icons} skill icons -> {os.path.abspath(out)}")


if __name__ == '__main__':
    main()
