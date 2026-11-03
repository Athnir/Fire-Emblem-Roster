"""Fire Emblem Engage (FE17) unit data for the Fire Emblem Roster, read from the user's own dump (update 2.0.0, Expansion Pass content
included in the update).

    build(romfs_dir) -> dict          everything below, as plain JSON-able data
    python fe17_units.py              writes out/fe17_units.json

The romfs is what scripts/fe17_extract.py writes (FE17_ROMFS changes it). Tables are the game's
XML books (gamedata/*.xml), text the English MSBT files (message/*.msbt), joins the battle scripts (scripts/*.lua). The reader of
the containers (scripts/fe17_data.py) is the Armory's, copied. data-raw/fe17/README.md has the formats and the mechanics as traced
in the program (main.bin), with method names and addresses.

Ids are kept next to every English name: PID_ (person), JID_ (class), SID_ (skill), GID_ (emblem), IID_ (item), CID_ (chapter).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fe17_data as D  # noqa: E402

# ---------------------------------------------------------------------------------------------------------------------------------
# The game's own orders and enums (names from the program's metadata, global-metadata.dat).

# Capability index order (person/job Offset, Limit, Grow, Base... fields and App.Capability indices 0-10).
CAP = ['Hp', 'Str', 'Tech', 'Quick', 'Luck', 'Def', 'Magic', 'Mdef', 'Phys', 'Sight', 'Move']
# English abbreviations as the game's status screen shows them (HP, Str, Mag, Dex, Spd, Def, Res, Lck, Bld, Mov).
EN = {'Hp': 'HP', 'Str': 'Str', 'Magic': 'Mag', 'Tech': 'Dex', 'Quick': 'Spd', 'Def': 'Def', 'Mdef': 'Res', 'Luck': 'Lck',
      'Phys': 'Bld', 'Move': 'Mov', 'Sight': 'Sight'}
SHOWN = ['Hp', 'Str', 'Magic', 'Tech', 'Quick', 'Def', 'Mdef', 'Luck', 'Phys', 'Move']      # display order, Sight left out
GROWN = CAP[:9]                    # App.Unit.LevelUp rolls indices 0-8 (HP .. Bld); Sight and Mov never grow

# App.ItemData.Kinds 0-9 = bit n of App.WeaponMask; the job tables' Weapon*/MaxWeaponLevel* columns in this order.
WEAPONS = ['None', 'Sword', 'Lance', 'Axe', 'Bow', 'Dagger', 'Magic', 'Rod', 'Fist', 'Special']
WEAPON_EN = {'Sword': 'Sword', 'Lance': 'Lance', 'Axe': 'Axe', 'Bow': 'Bow', 'Dagger': 'Knife', 'Magic': 'Tome', 'Rod': 'Staff',
             'Fist': 'Arts', 'Special': 'Special'}
WEAPON_RANKS = ['None', 'D', 'C', 'B', 'A', 'S']     # App.WeaponLevel.Kind
WEAPON_VALUE = {0: 'none', 1: 'always', 2: 'choose 1', 3: 'choose 2'}   # App.JobData.WeaponValues: Equippable, Selectable1/2
JOB_FLAGS = {1: 'CanCC', 2: 'AnyoneCC', 4: 'FemaleOnly', 8: 'EncountMap'}              # App.JobData.Flags
MOVE_TYPES = {0: 'None', 1: 'Foot', 2: 'Horse', 3: 'Fly', 4: 'Dragon', 5: 'Pad'}       # App.JobData.MoveTypes
PERSON_FLAGS = {1: 'CandidateForFriend', 2: 'BelongName', 4: 'Talent', 8: 'IgnoreJobSkillRemove', 16: 'DarkWarp',
                32: 'DressReverse', 64: 'SimpleUI', 128: 'DerivedHero', 256: 'SummonWarp'}   # App.PersonData.Flags
TIMING = {0: 'None', 1: 'Begin', 2: 'End', 3: 'Chapter', 4: 'Eternal'}               # App.PersonData.Timing
COUNTRY = {0: 'Free', 1: 'Lithos', 2: 'Firene', 3: 'Brodia', 4: 'Elusia', 5: 'Solm', 6: 'Gradlon'}  # App.PersonData.Country
GENDER = {1: 'male', 2: 'female'}
DIFFICULTIES = [('N', 'Normal'), ('H', 'Hard'), ('L', 'Maddening')]
# Support types (reliance.xml 支援効果 names; the game shows none of them, the Armory names them by what they raise most).
SUPPORT_TYPES = {'デフォルト': 'Default', 'バランス': 'Balanced', '命中': 'Hit', '必殺': 'Crit', '回避': 'Avoid', '必殺回避': 'Dodge'}
GOD_FLAGS = {1: 'NoAddExp', 2: 'EnableRingList', 4: 'UnitIconDarkness', 8: 'GaugeDarkness', 16: 'OnlyEngageWeapon', 32: 'Armlet'}
GROWTH_FLAGS = {1: 'UnlockSkillInheritance', 2: 'AddEngageTurnLimit', 4: 'SubEngageCountLimit'}  # App.GodGrowthData.Flags
STYLE_ITEM_FIELDS = [('EngageItems', 'all'), ('EngageCooperations', 'Backup'), ('EngageHorses', 'Cavalry'),
                     ('EngageCoverts', 'Covert'), ('EngageHeavys', 'Armored'), ('EngageFlys', 'Flying'),
                     ('EngageMagics', 'Mystical'), ('EngagePranas', 'Qi Adept'), ('EngageDragons', 'Dragon')]
STYLES = {'連携スタイル': 'Backup', '騎馬スタイル': 'Cavalry', '隠密スタイル': 'Covert', '重装スタイル': 'Armored',
          '飛行スタイル': 'Flying', '魔法スタイル': 'Mystical', '気功スタイル': 'Qi Adept', '竜族スタイル': 'Dragon',
          'スタイル無し': 'None'}

# Constants read from the program (App.Unit / App.JobData / App.GodBond literal fields, and code; data-raw/fe17/README.md has the addresses).
EQUIP_SKILL_MAX = 2            # App.Unit.EquipSkillMax: inherited (equipped) skill slots
SKILL_POINT_MAX = 9999         # App.Unit.SkillPointMax
LEVEL_UP_MIN_STATS = 2         # App.Unit.GrowAbortCount; LevelUpSequnece.Prepare calls LevelUp(2)
LEVEL_UP_TRIES = 4             # App.Unit.LevelUpRetryMax; LevelUp's loop
INTERNAL_LEVEL_CAP = {'Normal': 30, 'Hard': 40, 'Maddening': 50}   # calculator.xml 内部レベル計算 (read below too)

# The 'story' order of the chapter ids, for "first chapter" questions.
CHAPTER_ORDER = (['M%03d' % i for i in range(27)] + ['S%03d' % i for i in range(1, 16)] + ['G%03d' % i for i in range(1, 7)] +
                 ['E%03d' % i for i in range(1, 7)])


def set_romfs(romfs_dir):
    """Point the readers at a romfs and drop what they cached."""
    D.ROMFS = romfs_dir
    for f in (D.book, D.messages, D._all_text, D.terrain, D.dispos, D._emblems, D._item_names):
        f.cache_clear()


# ---------------------------------------------------------------------------------------------------------------------------------
# Small helpers.

TAG = re.compile(r'\[/?\d+:\d+(?::[0-9a-f]*)?\]')


def clean(s):
    """A text string without its control tags (MSBT 0x0E/0x0F, written [g:t:hex] by fe17_data)."""
    if s is None:
        return None
    return ' '.join(TAG.sub('', s).split())


def text(label):
    if not label:
        return None
    return clean(D.text(label))


def ints(row, prefix, keys=CAP):
    return {k: int(row[prefix + k] or 0) for k in keys}


def shown(d, keys=SHOWN):
    """A capability dict by the game's internal keys -> by the English abbreviations, display order."""
    return {EN[k]: d[k] for k in keys if k in d}


def lst(v):
    return D.flag_list(v) if v else []


def bits(v, names):
    v = int(v or 0)
    return [n for b, n in names.items() if v & b]


def weapon_set(mask):
    """A weapon mask (bit n = kind n) -> English weapon names."""
    mask = int(mask or 0)
    return [WEAPON_EN[w] for k, w in enumerate(WEAPONS) if k and mask & (1 << k)]


def round_grow(points):
    """App.UnitUtil.GetRoundGrow (0x1c759d0): max((points + 50) / 100, 0), the division truncating."""
    v = points + 50
    q = abs(v) // 100 * (1 if v >= 0 else -1)
    return max(q, 0)


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


# ---------------------------------------------------------------------------------------------------------------------------------
# Skills.

class Skills:
    """skill.xml: names, help, SP costs, stat bonuses; and the groups App.SkillData.GroupAssign (0x248d0c0) builds: consecutive
    rows whose Priority rises (by at most 50) are one group, a higher priority replacing a lower one in a skill array."""

    def __init__(self):
        self.rows = D.rows('skill')
        self.by_sid = {r['Sid']: r for r in self.rows}
        self.group = {}
        group, prev = 0, 0
        for r in self.rows:
            p = int(r['Priority'] or 0)
            if p == 0:
                prev = 0
                continue
            if prev == 0 or prev > p or prev + 50 < p:
                group += 1
            self.group[r['Sid']] = group
            prev = p
        self.used = set()

    def priority(self, sid):
        r = self.by_sid.get(sid)
        return int(r['Priority'] or 0) if r else 0

    def enhance(self, sid):
        r = self.by_sid.get(sid)
        if not r:
            return {}
        return {EN[k]: int(r['EnhanceValue.' + k] or 0) for k in CAP if k != 'Sight' and int(r['EnhanceValue.' + k] or 0)}

    def ref(self, sid):
        """A skill reference for the JSON: id, English name (None for the hidden ones)."""
        if not sid:
            return None
        self.used.add(sid)
        r = self.by_sid.get(sid)
        return {'sid': sid, 'name': text(r['Name']) if r and r['Name'] else None}

    def refs(self, sids):
        return [self.ref(s) for s in sids if s]

    def variants(self, sid):
        """The forms a skill takes (skill.xml): EngageSid (the skill while engaged; SID_無し none), ChangeSids (the forms when
        the emblem is switched, e.g. Eirika/Ephraim), SyncSids under SyncConditions, and the command skills whose
        RootCommandSid is this one (e.g. Edelgard's gambits)."""
        r = self.by_sid.get(sid)
        if not r:
            return None
        out = {}
        if r['EngageSid'] and r['EngageSid'] != 'SID_無し':
            out['engaged'] = self.ref(r['EngageSid'])
        ch = [s for s in lst(r['ChangeSids']) if s != sid]
        if ch:
            out['switched'] = self.refs(ch)
        conds, syncs = lst(r['SyncConditions']), lst(r['SyncSids'])
        if syncs:
            conds = conds + [''] * (len(syncs) - len(conds))
            out['conditional'] = [dict(self.ref(s), condition=c or None) for c, s in zip(conds, syncs) if s]
        cmds = [x['Sid'] for x in self.rows if x['RootCommandSid'] == sid]
        if cmds:
            out['commands'] = self.refs(cmds)
        return out or None

    def refs_with_variants(self, sids):
        out = []
        for s in sids:
            if not s:
                continue
            ref = self.ref(s)
            v = self.variants(s)
            if v:
                ref = dict(ref, variants=v)
            out.append(ref)
        return out

    def merge(self, sids):
        """Skills added in order to one array: a later skill of the same group replaces an earlier one of lower priority."""
        out = []
        for s in sids:
            g = self.group.get(s)
            if g is not None:
                same = [x for x in out if self.group.get(x) == g]
                if same:
                    old = same[0]
                    if self.priority(s) >= self.priority(old):
                        out[out.index(old)] = s
                    continue
            if s not in out:
                out.append(s)
        return out

    def table(self):
        out = {}
        for sid in sorted(self.used):
            r = self.by_sid.get(sid)
            if r is None:
                out[sid] = {'missing': True}
                continue
            enh = self.enhance(sid)
            out[sid] = {
                'name': text(r['Name']) if r['Name'] else None,
                'help': text(r['Help']) if r['Help'] else None,
                'command': text(r['CommandName']) if r['CommandName'] else None,
                'sp_cost': int(r['InheritanceCost'] or 0) or None,          # InheritanceCost: SP to inherit from an emblem
                'stat_bonus': enh or None,
                'group': self.group.get(sid),
                'priority': int(r['Priority'] or 0),
                'growth_change': ({'work': {'2': 'JobGrowChange', '3': 'TotalGrowChange'}[r['Work']],
                                   'op': r['WorkOperation'], 'value': float(r['WorkValue'] or 0)}
                                  if r['Work'] in ('2', '3') else None),
                'hidden': not bool(r['Name']) or text(r['Name']) is None,
            }
        return out

    def table_full(self):
        """The table with each skill's variants; variants can name further skills, so this runs until no new one appears."""
        while True:
            n = len(self.used)
            for sid in sorted(self.used):
                self.variants(sid)
            if len(self.used) == n:
                break
        out = self.table()
        for sid in out:
            v = self.variants(sid)
            if v:
                out[sid]['variants'] = v
        return out


# ---------------------------------------------------------------------------------------------------------------------------------
# Classes.

def job_weapons(r):
    """A class's weapons: each kind's value (always / choose 1 / choose 2) and its max rank, '+' meaning one rank higher for a unit
    with innate proficiency in it (App.JobData.OnBuild 0x2054c60 sets WeaponLevelPlusMask; GetMaxWeaponLevel 0x2056c30 adds 1)."""
    out = []
    for k, w in enumerate(WEAPONS):
        if not k:
            continue
        v = int(r['Weapon' + w] or 0)
        lvl = r['MaxWeaponLevel' + w] or 'N'
        if v == 0:
            continue
        rank = lvl[0]
        out.append({'weapon': WEAPON_EN[w], 'use': WEAPON_VALUE[v], 'max_rank': None if rank == 'N' else rank,
                    'plus_with_innate': lvl.endswith('+'),
                    'max_rank_innate': (None if rank == 'N' else
                                        (WEAPON_RANKS[min(WEAPON_RANKS.index(rank) + 1, 5)] if lvl.endswith('+') else rank))})
    return out


def job_requirement(r):
    """App.Unit.CCCheckAptitude (0x1a3c5f0): every 'always' weapon, plus 1 (or 2) of the 'choose' ones, must be among the unit's
    proficiencies. The Mage Cannoneer needs none (GameUserData.CanCCGunner); the Enchanter needs CanCCEnchant and then its weapons."""
    always, choose, need = [], [], 0
    for k, w in enumerate(WEAPONS):
        if not k:
            continue
        v = int(r['Weapon' + w] or 0)
        if v == 1:
            always.append(WEAPON_EN[w])
        elif v in (2, 3):
            choose.append(WEAPON_EN[w])
            need = max(need, v - 1)
    if r['Jid'] == 'JID_マージカノン':
        return {'all_of': [], 'choose': 0, 'from': [], 'note': 'no proficiency needed (CCCheckAptitude returns '
                                                               'GameUserData.CanCCGunner)'}
    return {'all_of': always, 'choose': need, 'from': choose}


DLC_CLASSES = {'JID_エンチャント', 'JID_マージカノン', 'JID_裏邪竜ノ娘', 'JID_裏邪竜ノ子', 'JID_メリュジーヌ_味方'}


def build_classes(skills, persons):
    rows = D.rows('job')
    items = {r['Iid']: r for r in D.rows('item')}
    by_jid = {r['Jid']: r for r in rows}
    low_of = {}
    for r in rows:
        for h in (r['HighJob1'], r['HighJob2']):
            if h:
                low_of.setdefault(h, []).append(r['Jid'])
    # Who can be each class that isn't open to anyone: the person whose default class it is, or a promotion of it
    # (ClassChange.ChangeJobData.CCCheck 0x19c6700: AnyoneCC, or IsDefaultJob).
    own = {}
    for p in persons:
        j = p['Jid']
        own.setdefault(j, set()).add(p['Pid'])
        if j in by_jid:
            for h in (by_jid[j]['HighJob1'], by_jid[j]['HighJob2']):
                if h:
                    own.setdefault(h, set()).add(p['Pid'])
    out = []
    for r in rows:
        flags = int(r['Flag'] or 0)
        if not flags & 1:                 # CanCC: the classes a player unit can be; the rest are foes', emblems' and story ones
            continue
        jid = r['Jid']
        maxlv = int(r['MaxLevel'])
        rank = int(r['Rank'] or 0)
        special = maxlv >= 40 and rank == 0 and not (r['HighJob1'] or r['HighJob2'])
        tier = 'advanced' if rank == 1 else ('special' if special else 'base')
        learn_level = 25 if maxlv > 39 else 5           # App.JobData.GetLearnJobSkillLevel (0x2056ca0)
        bases = ints(r, 'Base.')
        caps = ints(r, 'Limit.')
        seals = []
        if jid == 'JID_エンチャント':
            seals = ['Mystic Satchel (IID_エンチャント専用プルフ)']
        elif jid == 'JID_マージカノン':
            seals = ['Mage Cannon (IID_マージカノン専用プルフ)']
        else:
            if rank == 1 and low_of.get(jid):
                seals.append('Master Seal (IID_マスタープルフ) from ' + ', '.join(
                    f"{text(by_jid[l]['Name'])} ({l})" for l in low_of[jid]))
            seals.append('Second Seal (IID_チェンジプルフ)')
        locked = None if flags & 2 else sorted(own.get(jid, []))
        out.append({
            'jid': jid,
            'name': text(r['Name']),
            'help': text(r['Help']),
            'tier': tier,
            'rank': rank,
            'max_level': maxlv,
            'internal_level': int(r['InternalLevel'] or 0),
            'move_type': MOVE_TYPES.get(int(r['MoveType'] or 0)),
            'battle_style': STYLES.get(r['StyleName'], r['StyleName']),
            'flags': bits(flags, JOB_FLAGS),
            'expansion_pass': jid in DLC_CLASSES,
            'female_only': bool(flags & 4),
            'unique_to': locked,
            'bases': shown(bases),
            'caps': shown(caps),
            'mov': bases['Move'],
            'growth_modifiers': shown(ints(r, 'DiffGrow.'), SHOWN[:-1]),
            'enemy_growths': shown(ints(r, 'BaseGrow.'), SHOWN[:-1]),
            'enemy_growth_by_difficulty': {
                'Normal': shown(ints(r, 'DiffGrowNormal.'), SHOWN[:-1]),
                'Hard': shown(ints(r, 'DiffGrowHard.'), SHOWN[:-1]),
                'Maddening': shown(ints(r, 'DiffGrowLunatic.'), SHOWN[:-1])},
            'weapons': job_weapons(r),
            'proficiency_needed': job_requirement(r),
            'skills': skills.refs(lst(r['Skills'])),
            'learned_skill': ({'level': learn_level, **skills.ref(r['LearningSkill'])} if r['LearningSkill'] else None),
            'maddening_enemy_skill': skills.ref(r['LunaticSkill']) if r['LunaticSkill'] else None,
            'promotes_to': [{'jid': h, 'name': text(by_jid[h]['Name'])} for h in (r['HighJob1'], r['HighJob2']) if h],
            'promotes_from': [{'jid': l, 'name': text(by_jid[l]['Name'])} for l in low_of.get(jid, [])],
            'promotion_text': text(r['LowJob']) if r['LowJob'] else None,
            'seals': seals,
            'class_change_items': lst(r['CCItems']),
            'generic_items': [{'iid': 'IID_' + x, 'name': text(items['IID_' + x]['Name']) if 'IID_' + x in items else None}
                              for x in lst(r['UniqueItems'])],
            'attrs': int(r['Attrs'] or 0),
        })
    return out


# ---------------------------------------------------------------------------------------------------------------------------------
# Units.

def class_weapons_selected(job, items):
    """The weapons a unit's class gives it on joining: the 'always' kinds, plus the 'choose' kinds picked as the game does.
    From a placement with items (App.Unit.SetSelectedWeaponFromItems 0x1a3d9e0): the items' kinds in item order, then the rest in
    kind order; from the person alone (SetSelectedWeaponFromOriginalAptitude 0x1a0ba00) the innate kinds first."""
    always = [k for k, w in enumerate(WEAPONS) if k and int(job['Weapon' + w] or 0) == 1]
    selectable = [k for k, w in enumerate(WEAPONS) if k and int(job['Weapon' + w] or 0) in (2, 3)]
    need = max([int(job['Weapon' + WEAPONS[k]]) - 1 for k in selectable] or [0])
    chosen = []
    for k in items:
        if k in selectable and k not in chosen and len(chosen) < need:
            chosen.append(k)
    for k in selectable:
        if len(chosen) >= need:
            break
        if k not in chosen:
            chosen.append(k)
    return always, chosen


def item_kinds(iids, item_rows):
    out = []
    for iid in iids:
        r = item_rows.get(iid)
        if r and r['Kind'] and 1 <= int(r['Kind']) <= 9:
            out.append(int(r['Kind']))
    return out


def join_stats(person, job, diff):
    """A unit's stats when it joins, as App.Unit.CreateImpl1 (0x1a08740) and AutoGrowCapability (0x1a0b1b0 / 0x1a0ded0 ->
    CalculateAutoGrowCapability 0x1a0e0a0) make them:
        stored[i] = person.Offset<diff>[i] + GetRoundGrow(person.Grow[i] * (total level - 1))   (Mov: 0-2, others -120..120)
        total level = level + 19 in an advanced class (JobData.IsHigh), else level
    and the shown value (GetCapabilityImpl 0x1a5ba20) = clamp(stored + class base, 0, class cap + person cap modifier)."""
    level = int(person['Level'])
    total = level + 19 if int(job['Rank'] or 0) != 0 else level
    n = total - 1
    off = ints(person, 'Offset' + diff + '.')
    grow = ints(person, 'Grow.')
    base = ints(job, 'Base.')
    cap = {k: clamp(int(job['Limit.' + k]) + int(person['Limit.' + k]), 0, 255) for k in CAP}
    stored, out = {}, {}
    for k in CAP:
        v = round_grow(grow[k] * n) + off[k] if n >= 1 else off[k]
        v = clamp(v, 0, 2) if k == 'Move' else clamp(v, -120, 120)
        stored[k] = v
        out[k] = clamp(v + base[k], 0, cap[k])
    return out, stored, total


def other_versions(pid, persons, jobs):
    """Persons the story uses for this unit outside the main roster: the Prologue's Alear (PID_M000_リュール) and the Fell
    Xenologue's own copies (PID_E00n_<name>, placed in dispos e00n as Force 0), which are separate persons with their own data."""
    stem = pid[4:]
    out = []
    for r in persons.values():
        p = r['Pid']
        if p == 'PID_M000_' + stem or re.fullmatch(r'PID_E00\d_' + re.escape(stem), p):
            job = jobs.get(r['Jid'])
            out.append({'pid': p, 'level': int(r['Level']), 'class': {'jid': r['Jid'], 'name': text(job['Name']) if job else None},
                        'where': 'Prologue (CID_M000)' if 'M000' in p else f'Fell Xenologue {int(p[5:8])} (CID_{p[4:8]})'})
    return out or None


def build_units(skills, joins):
    persons = {r['Pid']: r for r in D.rows('person')}
    jobs = {r['Jid']: r for r in D.rows('job')}
    items = {r['Iid']: r for r in D.rows('item')}
    roster = [r['Pid'] for r in D.rows('reliance', '支援関係')]          # the support table lists every playable person
    placements = first_placements()
    out = []
    for order, pid in enumerate(roster):
        p = persons[pid]
        job = jobs[p['Jid']]
        stats = {}
        for d, dname in DIFFICULTIES:
            shown_d, stored, total = join_stats(p, job, d)
            stats[dname] = shown(shown_d)
        same = all(stats[n] == stats['Normal'] for _, n in DIFFICULTIES)
        caps = {k: clamp(int(job['Limit.' + k]) + int(p['Limit.' + k]), 0, 255) for k in CAP}
        # Proficiencies when joining: innate (Aptitude) | additional (SubAptitude) | the starting class's weapons
        # (App.Unit.AddAptitudeFromWeaponMask 0x1a0bf10, bits 1-9 of the class's weapon mask).
        innate, sub = int(p['Aptitude'] or 0), int(p['SubAptitude'] or 0)
        place = placements.get(pid)
        kinds = item_kinds(place['items'], items) if place and place['items'] else []
        if kinds:
            always, chosen = class_weapons_selected(job, kinds)
        else:
            innate_kinds = [k for k in range(1, 10) if innate & (1 << k)]
            always, chosen = class_weapons_selected(job, innate_kinds)
        class_mask = 0
        for k in always + chosen:
            class_mask |= 1 << k
        at_join = innate | sub | (class_mask & 0x3fe)
        il = int(p['InternalLevel'] or 0) or int(job['InternalLevel'] or 0)
        forms = [r['Pid'] for r in D.rows('person') if r['Pid'].startswith(pid + '_') and r['Pid'].endswith('竜化')]
        die_cid = p['ExistDieCid']
        out.append({
            'order': order,
            'pid': pid,
            'name': text(p['Name']),
            'gender': GENDER.get(int(p['Gender'] or 0)),
            'age': int(p['Age']) if p['Age'] and int(p['Age']) >= 0 else None,
            'birthday': {'month': int(p['BirthMonth'] or 0), 'day': int(p['BirthDay'] or 0)} if p['BirthMonth'] else None,
            'home': COUNTRY.get(int(p['Hometown'] or 0)),
            'expansion_pass': pid in ('PID_エル', 'PID_ラファール', 'PID_セレスティア', 'PID_グレゴリー', 'PID_マデリーン'),
            'class': {'jid': p['Jid'], 'name': text(job['Name'])},
            'level': int(p['Level']),
            'internal_level': il,
            'internal_level_source': 'person' if int(p['InternalLevel'] or 0) else 'class',
            'auto_level_total': join_stats(p, job, 'N')[2],
            'join_stats': stats['Normal'] if same else stats,
            'join_stats_same_on_every_difficulty': same,
            'stat_offsets': {n: shown(ints(p, f'Offset{d}.')) for d, n in DIFFICULTIES} if not same else
                            shown(ints(p, 'OffsetN.')),
            'growths': shown(ints(p, 'Grow.'), SHOWN[:-1]),
            'cap_modifiers': shown(ints(p, 'Limit.')),
            'caps_in_starting_class': shown(caps),
            'proficiencies': {
                'innate': weapon_set(innate),
                'additional': weapon_set(sub),
                'starting_class_weapons': weapon_set(class_mask),
                'at_join': weapon_set(at_join),
            },
            'personal_skills': skills.refs(lst(p['CommonSids'])),
            'enemy_skills_by_difficulty': ({'Normal': skills.refs(lst(p['NormalSids'])), 'Hard': skills.refs(lst(p['HardSids'])),
                                            'Maddening': skills.refs(lst(p['LunaticSids']))}
                                           if p['NormalSids'] or p['HardSids'] or p['LunaticSids'] else None),
            'engage_skill': skills.ref(p['EngageSid']) if p['EngageSid'] else None,
            'starting_sp': int(p['SkillPoint'] or 0),
            'support_category': {'id': p['SupportCategory'], 'name': SUPPORT_TYPES.get(p['SupportCategory'])},
            'starting_items_person': lst(p['Items']),
            'starting_items_placement': place['items'] if place else None,
            # Permadeath protection (person ExistDieCid/ExistDieTiming; App.Unit.IsExistDie 0x1a22540 -> UnitUtil.DieType.Exist):
            # the unit retreats instead of dying until that chapter begins/ends, or always ('Eternal').
            'death_protection': ({'until_cid': die_cid or None, 'timing': TIMING.get(int(p['ExistDieTiming'] or 0))}
                                 if int(p['ExistDieTiming'] or 0) else None),
            'person_flags': bits(p['Flag'], PERSON_FLAGS),
            'dragon_forms': forms,
            'other_versions': other_versions(pid, persons, jobs),
            'join': joins.get(pid),
        })
    return out


def first_placements():
    """Each playable person's first placement in a story battle (dispos), story order: chapter, group, force, items."""
    play = {r['Pid'] for r in D.rows('reliance', '支援関係')}
    out = {}
    for cid in CHAPTER_ORDER:
        if not os.path.exists(os.path.join(D.ROMFS, 'gamedata', 'dispos', cid.lower() + '.xml')):
            continue
        for g, rows in D.dispos(cid.lower()):
            for r in rows:
                if r['Pid'] in play and r['Pid'] not in out:
                    out[r['Pid']] = {'cid': 'CID_' + cid, 'group': g, 'force': int(r['Force'] or 0),
                                     'items': [r[f'Item{k}.Iid'] for k in range(1, 7) if r[f'Item{k}.Iid']]}
    return out


# ---------------------------------------------------------------------------------------------------------------------------------
# Joins, from the battle scripts.

FUNC = re.compile(r'^function\s+([^\s(]+)\s*\(', re.M)
JOIN = re.compile(r'\bUnitJoin\s*\(([^)]*)\)')
STR = re.compile(r'"([^"]*)"')


def script_functions(src):
    """[(name, start, end, body)] of a Lua source's top-level functions."""
    starts = [(m.group(1), m.start()) for m in FUNC.finditer(src)]
    out = []
    for i, (name, s) in enumerate(starts):
        e = starts[i + 1][1] if i + 1 < len(starts) else len(src)
        out.append((name, s, e, src[s:e]))
    return out


def join_sites():
    """Every UnitJoin call: script, function, line, the persons it joins (literal ids, or a variable assigned one earlier in the
    function), and how the function is reached (EventEntry* registrations, the program's hooks, or other functions)."""
    folder = os.path.join(D.ROMFS, 'scripts')
    sites = []
    for fn in sorted(os.listdir(folder)):
        if not fn.endswith('.lua'):
            continue
        name = fn[:-4]
        src = strip_comments(D.script(name))
        funcs = script_functions(src)
        for fname, s, e, body in funcs:
            for m in JOIN.finditer(body):
                args = [a.strip() for a in m.group(1).split(',') if a.strip()]
                pids = []
                for a in args:
                    lit = STR.fullmatch(a)
                    if lit:
                        pids.append(lit.group(1))
                    else:
                        assigns = re.findall(r'\b' + re.escape(a) + r'\s*=\s*"([^"]+)"', body[:m.start()])
                        if assigns:
                            pids.append(assigns[-1])
                line = src.count('\n', 0, s + m.start()) + 1
                sites.append({'script': name, 'function': fname, 'line': line, 'pids': pids,
                              'reached_by': reached_by(src, funcs, fname, depth=0)})
    return sites


HOOKS = {'Startup', 'Opening', 'MapOpening', 'MapEnding', 'Ending', 'GameOver', 'Cleanup'}


def strip_comments(src):
    """A Lua source with its comments blanked (block comments --[[ ]] and --[=[ ]=], then line comments), line numbers kept."""
    def blank(m):
        return re.sub(r'[^\n]', ' ', m.group(0))
    src = re.sub(r'--\[(=*)\[.*?\]\1\]', blank, src, flags=re.S)
    out = []
    for line in src.split('\n'):
        i, q = 0, None
        while i < len(line):
            c = line[i]
            if q:
                if c == '\\':
                    i += 1
                elif c == q:
                    q = None
            elif c in '"\'':
                q = c
            elif line.startswith('--', i):
                line = line[:i]
                break
            i += 1
        out.append(line)
    return '\n'.join(out)


def reached_by(src, funcs, fname, depth):
    if fname in HOOKS or fname.startswith('Hub'):
        return [{'hook': fname}]
    out = []
    for m in re.finditer(r'\b(EventEntry\w+)\s*\(\s*' + re.escape(fname) + r'\s*,([^\n]*)\)', src):
        out.append({'event': m.group(1), 'args': [a.strip() for a in m.group(2).split(',')]})
    if depth < 3:
        for other, s, e, body in funcs:
            if other == fname:
                continue
            if re.search(r'(?<![\w.])' + re.escape(fname) + r'\s*\(', body):
                for r in reached_by(src, funcs, other, depth + 1):
                    out.append({'via': other, **r})
    return out


# Each playable unit's join, as the game does it: (chapter, kind, note, evidence). Kinds: 'start' (in your army when the chapter
# starts), 'event' (joins by a scripted event during the map), 'talk' (joins when one of the named units talks to it), 'after'
# (joins after the chapter, in its post-battle or Somniel scene). Each evidence (script, function) must hold a UnitJoin of the
# person (build_joins checks it); the turn-1 events are EventEntryTurn(f, 1, 1, FORCE_PLAYER) registrations (or TurnAfter).
JOINS = {
    'PID_リュール': ('M001', 'start', 'Chapter 1: the Lord, in the Hero group (m001 dispos, Force 0).', []),
    'PID_ヴァンドレ': ('M001', 'start', 'Chapter 1: in your army from the start (m001 dispos group Ally, Force 0).', []),
    'PID_クラン': ('M002', 'start', 'Chapter 2: in the Player group (Force 0). In Chapter 1 he is a green ally (Force 2, '
                                 'SID_死亡回避) that m001.lua removes in the mid-map Marth event (双子離脱).', []),
    'PID_フラン': ('M002', 'start', 'Chapter 2: in the Player group (Force 0). In Chapter 1 she is a green ally (Force 2, '
                                 'SID_死亡回避) that m001.lua removes in the mid-map Marth event (双子離脱).', []),
    'PID_アルフレッド': ('M003', 'event', 'Chapter 3: the Firene group arrives on turn 2 (player phase) and joins at once.',
                    [('m003', 'ターン_フィレネ勢加勢')]),
    'PID_エーティエ': ('M003', 'event', 'Chapter 3: arrives with Alfred on turn 2 and joins at once.',
                   [('m003', 'ターン_フィレネ勢加勢')]),
    'PID_ブシュロン': ('M003', 'event', 'Chapter 3: arrives with Alfred on turn 2 and joins at once.',
                   [('m003', 'ターン_フィレネ勢加勢')]),
    'PID_セリーヌ': ('M004', 'event', 'Chapter 4: her opening-scene copy (group Ally) is deleted in MapOpening; she is placed '
                                  '(group Celine, green) in the turn-1 event and joins at once.',
                  [('m004', 'セリーヌ合流とセリカ顕現')]),
    'PID_ルイ': ('M004', 'event', 'Chapter 4: green at the start; joins with Céline in the turn-1 event.',
               [('m004', 'セリーヌ合流とセリカ顕現')]),
    'PID_クロエ': ('M004', 'event', 'Chapter 4: green at the start; joins with Céline in the turn-1 event.',
                [('m004', 'セリーヌ合流とセリカ顕現')]),
    'PID_ユナカ': ('M006', 'event', 'Chapter 6: green at the start; joins in the turn-1 event.', [('m006', '進撃開始直後イベント')]),
    'PID_スタルーク': ('M007', 'event', 'Chapter 7: green at the start; joins in the turn-1 event.', [('m007', 'スタルーク隊加入')]),
    'PID_シトリニカ': ('M007', 'event', 'Chapter 7: green at the start; joins with Alcryst in the turn-1 event.',
                   [('m007', 'スタルーク隊加入')]),
    'PID_ラピス': ('M007', 'event', 'Chapter 7: green at the start; joins with Alcryst in the turn-1 event.',
                 [('m007', 'スタルーク隊加入')]),
    'PID_ディアマンド': ('M008', 'event', 'Chapter 8: green at the start; joins in the turn-1 event.', [('m008', '進撃開始直後イベント')]),
    'PID_アンバー': ('M008', 'event', 'Chapter 8: green at the start; joins with Diamant in the turn-1 event.',
                  [('m008', '進撃開始直後イベント')]),
    'PID_ジェーデ': ('M009', 'talk', 'Chapter 9: green; joins when Alear or Diamant talks to her. If she survives without being '
                                  'talked to, she joins after the chapter (m009_kizuna Ending).',
                  [('m009', 'ジェーデ加入'), ('m009_kizuna', 'Ending')]),
    'PID_アイビー': ('M011', 'event', 'Chapter 11: placed mid-map as a green group (Ally_Add0) and joins by event; if that event '
                                  'never plays, MapEnding adds her.', [('m011', 'アイビー隊仲間入り'), ('m011', 'MapEnding')]),
    'PID_カゲツ': ('M011', 'event', 'Chapter 11: arrives with Ivy (Ally_Add0) and joins in the same event.',
                 [('m011', 'アイビー隊仲間入り'), ('m011', 'MapEnding')]),
    'PID_ゼルコバ': ('M011', 'event', 'Chapter 11: arrives with Ivy (Ally_Add1) and joins in the same event.',
                  [('m011', 'アイビー隊仲間入り'), ('m011', 'MapEnding')]),
    'PID_フォガート': ('M012', 'event', 'Chapter 12: green at the start; joins in the turn-1 event.',
                   [('m012', '自軍ターン前_自警団仲間入り')]),
    'PID_パンドロ': ('M012', 'event', 'Chapter 12: green at the start; joins with Fogado in the turn-1 event.',
                  [('m012', '自軍ターン前_自警団仲間入り')]),
    'PID_ボネ': ('M012', 'event', 'Chapter 12: green at the start; joins with Fogado in the turn-1 event.',
               [('m012', '自軍ターン前_自警団仲間入り')]),
    'PID_ミスティラ': ('M013', 'event', 'Chapter 13: green at the start; joins in the turn-1 event.', [('m013', '進撃開始直後イベント')]),
    'PID_メリン': ('M013', 'event', 'Chapter 13: green at the start; joins with Timerra in the turn-1 event.',
                 [('m013', '進撃開始直後イベント')]),
    'PID_パネトネ': ('M013', 'event', 'Chapter 13: green at the start; joins with Timerra in the turn-1 event.',
                  [('m013', '進撃開始直後イベント')]),
    'PID_オルテンシア': ('M014', 'after', 'After Chapter 14, in its post-battle scene (m014_kizuna Opening); she is not on your '
                                     'side on the map.', [('m014_kizuna', 'Opening')]),
    'PID_セアダス': ('M015', 'talk', 'Chapter 15: green; joins when Alear talks to him.', [('m015', 'セアダス加入')]),
    'PID_ロサード': ('M016', 'event', 'Chapter 16: green at the start; joins in the turn-1 event.', [('m016', '進撃開始直後イベント')]),
    'PID_ゴルドマリー': ('M016', 'event', 'Chapter 16: green at the start; joins with Rosado in the turn-1 event.',
                    [('m016', '進撃開始直後イベント')]),
    'PID_リンデン': ('M018', 'talk', 'Chapter 18: an enemy (Force 1); recruited when Alear, Ivy or Hortensia talks to him.',
                  [('m018', 'リンデン加入')]),
    'PID_ザフィーア': ('M019', 'talk', 'Chapter 19: green; joins when Alear, Diamant or Alcryst talks to her. If she survives '
                                    'without being talked to, she joins after the chapter (m019_kizuna Ending).',
                   [('m019', 'ザフィーア会話'), ('m019_kizuna', 'Ending')]),
    'PID_モーヴ': ('M021', 'event', 'Chapter 21: green at the start; joins in the turn-1 event.', [('m021', '進撃開始直後イベント')]),
    'PID_ヴェイル': ('M022', 'event', 'Chapter 22: green at the start; joins in the turn-1 event.', [('m022', '青１ターン開始直後')]),
    'PID_ジャン': ('S001', 'talk', 'Paralogue "Budding Talent" (opens after Chapter 5): green; joins when Alear talks to him. '
                               'If he survives, he joins after the battle (s001_kizuna Opening).',
                 [('s001', 'ジャン加入会話'), ('s001_kizuna', 'Opening')]),
    'PID_アンナ': ('S002', 'talk', 'Paralogue "Mysterious Merchant" (opens after Chapter 6): appears when the chest at (13,3) is '
                               'opened (group Ally_Tbox) and joins at once if Alear opened it; otherwise Alear talks to her. '
                               'If she survives, she joins after the battle (s002_kizuna Opening).',
                 [('s002', '宝箱から登場'), ('s002', 'アンナ加入'), ('s002_kizuna', 'Opening')]),
    'PID_エル': ('E006', 'after', 'Expansion Pass: joins the main game in the Somniel once Fell Xenologue 6 is cleared '
                               '(hub_solanelcommon_p3 HubSolanelEvilEnd).', [('hub_solanelcommon_p3', 'HubSolanelEvilEnd')]),
    'PID_ラファール': ('E006', 'after', 'Expansion Pass: joins with Nel in the Somniel after Fell Xenologue 6.',
                    [('hub_solanelcommon_p3', 'HubSolanelEvilEnd')]),
    'PID_セレスティア': ('E006', 'after', 'Expansion Pass: joins in the Somniel after Fell Xenologue 6.',
                     [('hub_solanelcommon_p3', 'HubSolanelEvilEnd')]),
    'PID_グレゴリー': ('E006', 'after', 'Expansion Pass: joins in the Somniel after Fell Xenologue 6.',
                    [('hub_solanelcommon_p3', 'HubSolanelEvilEnd')]),
    'PID_マデリーン': ('E006', 'after', 'Expansion Pass: joins in the Somniel after Fell Xenologue 6.',
                    [('hub_solanelcommon_p3', 'HubSolanelEvilEnd')]),
}


def build_joins():
    sites = join_sites()
    by_pid = {}
    for s in sites:
        for p in s['pids']:
            by_pid.setdefault(p, []).append(s)
    placements = first_placements()
    chapters = {r['Cid']: r for r in D.rows('chapter')}
    out = {}
    for pid, (cid, how, note, evidence) in JOINS.items():
        found = by_pid.get(pid, [])
        for script, func in evidence:
            ok = any(s['script'] == script and (func is None or s['function'] == func) for s in found)
            if not ok:
                raise AssertionError(f'{pid}: no UnitJoin in {script}.{func}')
        place = placements.get(pid)
        c = chapters.get('CID_' + cid)
        out[pid] = {
            'cid': 'CID_' + cid,
            'chapter': (f"{text('MCID_' + cid + '_PREFIX')}: {text('MCID_' + cid)}" if c else None),
            'how': how,
            'note': note,
            'first_placement': place,
            'script_sites': [{k: s[k] for k in ('script', 'function', 'line', 'reached_by')} for s in found],
        }
    missing = {p for p in by_pid if p.startswith('PID_') and p not in JOINS and not p.startswith('PID_E00')}
    return out, sites, sorted(missing)


# ---------------------------------------------------------------------------------------------------------------------------------
# Emblems.

PLAYER_EMBLEMS = ['GID_マルス', 'GID_シグルド', 'GID_セリカ', 'GID_ミカヤ', 'GID_ロイ', 'GID_リーフ', 'GID_ルキナ', 'GID_リン',
                  'GID_アイク', 'GID_ベレト', 'GID_カムイ', 'GID_エイリーク', 'GID_エフラム', 'GID_リュール',
                  'GID_エーデルガルト', 'GID_ディミトリ', 'GID_クロード', 'GID_チキ', 'GID_ヘクトル', 'GID_ヴェロニカ',
                  'GID_セネリオ', 'GID_カミラ', 'GID_クロム', 'GID_ルフレ']
DLC_EMBLEMS = {'GID_エーデルガルト', 'GID_ディミトリ', 'GID_クロード', 'GID_チキ', 'GID_ヘクトル', 'GID_ヴェロニカ',
               'GID_セネリオ', 'GID_カミラ', 'GID_クロム', 'GID_ルフレ'}


def growth_tables():
    """god.xml 成長表: {Ggid: [level rows]} (a row naming Ggid starts a table)."""
    out, cur = {}, None
    for r in D.rows('god', '成長表'):
        if r['Ggid']:
            cur = r['Ggid']
            out[cur] = []
            continue
        out[cur].append(r)
    return out


def build_emblems(skills):
    gods = {r['Gid']: r for r in D.rows('god', '神将')}
    tables = growth_tables()
    item_rows = {r['Iid']: r for r in D.rows('item')}
    out = []
    for gid in PLAYER_EMBLEMS:
        g = gods[gid]
        table = tables.get(g['GrowTable'], [])
        sync_all, engage_all, levels = [], [], []
        prof_total = 0
        flags_so_far = []
        for row in table:
            lv = int(row['Level'])
            sync_new = lst(row['SynchroSkills'])
            engage_new = lst(row['EngageSkills'])
            sync_all = skills.merge(sync_all + sync_new)
            engage_all = skills.merge(engage_all + engage_new)
            apt = int(row['Aptitude'] or 0)
            prof_total |= apt
            bonus = {}
            for s in sync_all:
                for k, v in skills.enhance(s).items():
                    bonus[k] = bonus.get(k, 0) + v
            weapons = {}
            for field, style in STYLE_ITEM_FIELDS:
                ids = lst(row[field])
                if ids:
                    weapons[style] = [{'iid': i, 'name': text(item_rows[i]['Name']) if i in item_rows else None} for i in ids]
            fl = bits(row['Flag'], GROWTH_FLAGS)
            flags_so_far += fl
            levels.append({
                'bond_level': lv,
                'inheritable_new': [dict(skills.ref(s), sp=int(skills.by_sid[s]['InheritanceCost'] or 0) if s in skills.by_sid
                                         else None) for s in lst(row['InheritanceSkills'])],
                'sync_skills_new': skills.refs_with_variants(sync_new),
                'engage_skills_new': skills.refs_with_variants(engage_new),
                'sync_skills': skills.refs(sync_all),
                'engage_skills': skills.refs(engage_all),
                'sync_stat_bonus': bonus,
                'proficiency_granted': weapon_set(apt),
                'proficiency_cost_field': {WEAPON_EN[w]: int(row['AptitudeCost' + w] or 0) for w in WEAPONS[1:]
                                           if int(row['AptitudeCost' + w] or 0)} or None,
                'engage_weapons_new': weapons or None,
                'flags': fl,
            })
        out.append({
            'gid': gid,
            'name': text(g['Mid']),
            'nickname': text(g['Nickname']) if g['Nickname'] else None,
            'expansion_pass': gid in DLC_EMBLEMS,
            'ring_name': text(g['Ringname']) if g['Ringname'] else None,
            'flags': bits(g['Flag'], GOD_FLAGS),
            'switches_with': [x for x in lst(g['Change']) if x != gid],
            'shares_bond_with': g['Gbid'],
            'growth_table': g['GrowTable'],
            'engage_attack': skills.ref(g['EngageAttack']) if g['EngageAttack'] else None,
            'engage_attack_linked': ({'with': g['LinkGid'], **skills.ref(g['EngageAttackLink'])}
                                     if g['EngageAttackLink'] else None),
            'engage_count': int(g['EngageCount'] or 0),
            'bond_level_cap': int(g['LevelCap'] or 0),
            'bond_level_cap_unlock_variable': g['UnlockLevelCapVarName'] or None,
            'linked_person': g['Link'] or None,
            'good_weapon': WEAPON_EN.get(WEAPONS[int(g['GoodWeapon'] or 0)]) if int(g['GoodWeapon'] or 0) else None,
            'sync_enhance_field': {EN[k]: int(g['SynchroEnhance.' + k] or 0) for k in CAP if k != 'Sight'
                                   and int(g['SynchroEnhance.' + k] or 0)} or None,
            'proficiencies_total': weapon_set(prof_total),
            'levels': levels,
        })
    bond = [{'level': int(r['Level']), 'exp': int(r['Exp'] or 0), 'support_conversation': r['RelianceLevel'] or None,
             'cost': int(r['Cost'] or 0)} for r in D.rows('god', '絆レベル')]
    return out, bond


# ---------------------------------------------------------------------------------------------------------------------------------
# Supports.

def build_supports():
    rows = D.rows('reliance', '支援関係')
    pids = [r['Pid'] for r in rows]
    names = {r['Pid']: text(r['Name']) for r in D.rows('person')}
    exps = {i: r for i, r in enumerate(D.rows('reliance', '必要経験値'))}
    pairs = []
    for i, r in enumerate(rows):
        for j in range(len(pids)):
            v = int(r.get(f'ExpType{j}') or 0)
            if v:
                e = exps[v]
                pairs.append({'a': pids[j], 'a_name': names[pids[j]], 'b': r['Pid'], 'b_name': names[r['Pid']],
                              'max_rank': 'A', 'exp_pattern': e['Rexid'],
                              'exp_needed': {'C': int(e['ExpC']), 'B': int(e['ExpB']), 'A': int(e['ExpA'])}})
    effects = {}
    current = None
    for r in D.rows('reliance', '支援効果'):
        if r['Name']:
            current = SUPPORT_TYPES[r['Name']]
            effects[current] = []
            continue
        effects[current].append({'level': ['C', 'B', 'A', 'Ring'][int(r['Level']) - 1], 'hit': int(r['Hit']),
                                 'crit': int(r['Critical']), 'avoid': int(r['Avoid']), 'dodge': int(r['Secure'])})
    by = {}
    for p in pairs:
        by.setdefault(p['a'], []).append(p['b'])
        by.setdefault(p['b'], []).append(p['a'])
    return {
        'pairs': pairs,
        'partners': {p: sorted(set(v), key=pids.index) for p, v in by.items()},
        'levels': ['C', 'B', 'A', 'A+ (Pact Ring)'],
        'pact_ring': {
            'item': 'IID_約束の指輪',
            'who': 'Alear (the Hero, UnitPool.GetHero) with one partner who has an A support with Alear',
            'unlocked': 'end of Paralogue "The Connector" (CID_S015, opens after Chapter 22): s015.lua Ending calls '
                        'UnitReliancePermitAPlus()',
            'one_partner': True,
        },
        'type_effects_reference_only': effects,
    }


# ---------------------------------------------------------------------------------------------------------------------------------
# Bond rings, stat boosters, chapters.

def build_bond_rings(skills):
    """Each bond ring by its Rnid without the rank (RNID_<series>_<hero>), its ranks in the table's order. <series> is the game's
    own short title for the set (紋章 Mystery of the Emblem, 聖戦 Genealogy, ...; DLC1コモン the Expansion Pass's three); Gid is
    the emblem whose pedestal forges it (RefineRingExecute.Do 0x2952990 picks among the rings with that Gid), and Engage names that
    emblem's world (MGID_World_<the emblem's Mid>, bondsring.msbt). The 金属カラー rows have no English name: not rings."""
    rows = D.rows('ring')
    gods = {g['Gid']: g for g in D.rows('god')}
    rank = {'0': 'C', '1': 'B', '2': 'A', '3': 'S'}
    rings = {}
    for r in rows:
        if not r['Rnid'] or not r['Name']:
            continue
        name = text(r['Name'])
        if not name:
            continue
        key = r['Rnid'].rsplit('_', 1)[0]
        god = gods.get(r['Gid'])
        e = rings.setdefault(key, {
            'name': name, 'series': key.split('_')[1], 'gid': r['Gid'] or None,
            'emblem': text(god['Mid']) if god else None,
            'world': text('MGID_World_' + god['Mid'][len('MGID_'):]) if god else None,
            'ranks': {}})
        e['ranks'][rank[r['Rank']]] = {
            'rnid': r['Rnid'],
            'stat_bonus': {EN[k]: int(r['Enhance.' + k] or 0) for k in SHOWN if int(r['Enhance.' + k] or 0)},
            'skills': skills.refs(lst(r['EquipSids'])),
            'single_rank': r['IsSingleRank'] == 'true'}
    return {
        'format': 'ring.xml 指輪: Rnid (RNID_<series>_<hero>_<rank>), Name, Gid (the emblem whose rings these are), Rank '
                  '(0 C, 1 B, 2 A, 3 S), Enhance.* (stat bonuses while worn), EquipSids (skills while worn; some S ranks), '
                  'IsSingleRank (rings that only come in one rank).',
        'count': len(rings),
        'rings': rings,
    }


def build_boosters():
    out = []
    for r in D.rows('item'):
        if r['UseType'] == '21':                       # App.ItemData.UseTypes.GrowUp
            out.append({'iid': r['Iid'], 'name': text(r['Name']), 'help': text(r['Help']),
                        'raises': {EN[k]: int(r['Enhance.' + k] or 0) for k in CAP if k != 'Sight'
                                   and int(r['Enhance.' + k] or 0)},
                        'price': int(r['Price'] or 0)})
    sp_books = [{'iid': r['Iid'], 'name': text(r['Name']), 'help': text(r['Help'])} for r in D.rows('item')
                if r['UseType'] == '42']           # GainSkillPoint
    return out, sp_books


def build_chapters():
    out = {}
    for r in D.rows('chapter'):
        c = r['Cid'][4:]
        if c[0] not in 'MSGE':
            continue
        out[r['Cid']] = {'prefix': text('MCID_' + c + '_PREFIX'), 'name': text('MCID_' + c),
                         'opens_after': r['GmapSpotOpenCondition'] or None, 'next': r['NextChapter'] or None,
                         'recommended_level': int(r['RecommendedLevel'] or 0)}
    return out


def internal_level_formula():
    """calculator.xml 共通 内部レベル計算: the internal level a class change leaves (per difficulty)."""
    for r in D.rows('calculator'):
        if r['Name'] == '内部レベル計算':
            return {'condition': r['Condition'], 'function': r['Function']}
    return None


# ---------------------------------------------------------------------------------------------------------------------------------

def build(romfs_dir=None):
    if romfs_dir:
        set_romfs(romfs_dir)
    skills = Skills()
    persons = [r for r in D.rows('person') if r['Pid'] in {x['Pid'] for x in D.rows('reliance', '支援関係')}]
    joins, sites, unlisted = build_joins()
    units = build_units(skills, joins)
    classes = build_classes(skills, persons)
    emblems, bond_levels = build_emblems(skills)
    boosters, sp_books = build_boosters()
    data = {
        'meta': {
            'game': 'Fire Emblem Engage', 'id': 'fe17', 'update': '2.0.0 (v327680), Expansion Pass content included',
            'romfs': os.path.abspath(D.ROMFS),
            'stat_order': [EN[k] for k in SHOWN],
            'growth_stats': [EN[k] for k in GROWN],
            'weapon_kinds': [WEAPON_EN[w] for w in WEAPONS[1:]],
            'difficulties': [n for _, n in DIFFICULTIES],
            'weapon_ranks': WEAPON_RANKS[1:],
        },
        'units': units,
        'classes': classes,
        'emblems': emblems,
        'bond_levels': bond_levels,
        'supports': build_supports(),
        'bond_rings': build_bond_rings(skills),
        'stat_boosters': boosters,
        'sp_books': sp_books,
        'chapters': build_chapters(),
        'join_script_sites': sites,
        'join_sites_not_mapped': unlisted,
        'mechanics': {
            'equip_skill_slots': EQUIP_SKILL_MAX,
            'skill_point_max': SKILL_POINT_MAX,
            'level_up_min_stats': LEVEL_UP_MIN_STATS,
            'level_up_tries': LEVEL_UP_TRIES,
            'internal_level_after_class_change': internal_level_formula(),
            'class_skill_learn_level': {'max level 20': 5, 'max level 40': 25},
        },
    }
    data['skills'] = skills.table_full()
    return data


def main():
    data = build(os.environ.get('FE17_ROMFS') or None)
    out_dir = os.path.join(HERE, 'out')
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, 'fe17_units.json')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print('wrote', path, len(data['units']), 'units,', len(data['classes']), 'classes,', len(data['emblems']), 'emblems,',
          len(data['skills']), 'skills')
    if data['join_sites_not_mapped']:
        print('UnitJoin sites for persons not in the join table:', data['join_sites_not_mapped'])


if __name__ == '__main__':
    main()
