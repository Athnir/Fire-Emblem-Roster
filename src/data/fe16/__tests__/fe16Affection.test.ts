import { describe, expect, it } from 'vitest'
import { FE16_AFFECTION, FE16_SPELL_STATS, FE16_TEA, FE16_UNITS } from '../fe16Units'

// The Affection tab's data (fixed_lobby_common.bin, fixed_presentdata.bin, the monastery's lines) and the Spells tab's numbers.
// Samurai Gamers' tea party guides (fetched 2026-11-06): each unit's final lines in order, with the reactions right for each, and their
// favorite teas.
const GUIDE_LINES: Record<string, [string, string[]][]> = {
  Edelgard: [
    ['It upsets Hubert', ['Nod', 'Laugh']],
    ["If I hadn't been born", ['Laugh', 'Praise']],
    ["You're much more meticulous", ['Nod', 'Disagree', 'Blush']],
    ['A moment of relaxation', ['Sip tea', 'Blush']],
    ['Do you remember the day', ['Nod', 'Blush']],
    ["You're always so calm", ['Disagree', 'Sigh', 'Sip tea']],
    ["One day, I'll show you", ['Nod']],
    ['Here I can take a break', ['Nod', 'Laugh', 'Blush']],
    ['I have no intention', ['Commend', 'Chat', 'Praise']],
  ],
  Dimitri: [
    ['Please join me for training', ['Nod', 'Disagree', 'Blush']],
    ['I cannot tell you how long', ['Laugh', 'Sip tea']],
    ['I apologize for troubling you', ['Nod', 'Blush']],
    ['Perhaps because of my strength', ['Chat', 'Praise']],
    ['When I feel down', ['Nod']],
    ['I do my training', ['Nod', 'Laugh']],
    ['You really helped me', ['Disagree', 'Blush', 'Praise']],
    ['I would invite you to my quarters', ['Laugh', 'Disagree']],
    ['These last five years', ['Chat', 'Praise']],
  ],
  Seteth: [
    ['I wonder why the archbishop', ['Chat', 'Sip tea']],
    ['I do hope you will inform me', ['Nod']],
    ['I know I speak harshly', ['Nod', 'Sigh']],
    ['You have become very special', ['Nod', 'Chat']],
    ['The more you learn about yourself', ['Nod', 'Chat']],
    ['If there is anything I can do', ['Nod', 'Laugh', 'Blush']],
    ['When my own thoughts grow tiresome', ['Nod', 'Laugh']],
    ['Whatever happens', ['Chat', 'Blush']],
    ['I put up a stiff front', ['Nod', 'Laugh', 'Blush']],
  ],
}
const GUIDE_TEAS: Record<string, string[]> = {
  Dimitri: ['Chamomile'],
  Seteth: ['Four-Spice Blend', 'Ginger Tea', 'Angelica Tea'],
}

const byName = (name: string) => FE16_AFFECTION[FE16_UNITS.find((u) => u.name === name)!.id]

describe('Three Houses tea parties, gifts and lost items', () => {
  it('has every unit but the Byleths, each with nine final lines (Constance two sets) and their own topic', () => {
    const units = FE16_UNITS.filter((u) => !u.id.startsWith('fe16-byleth'))
    expect(Object.keys(FE16_AFFECTION).sort()).toEqual(units.map((u) => u.id).sort())
    for (const u of units) {
      const a = FE16_AFFECTION[u.id]
      expect(a.lines, u.name).toHaveLength(u.name === 'Constance' ? 18 : 9)
      expect(a.personalTopic, u.name).toMatch(/\.\.\.$/)
      expect(a.teas.length, u.name).toBeGreaterThan(0)
      // The Ashen Wolves have two lost items, everyone else three.
      expect(a.lostItems, u.name).toHaveLength(u.house === 'Ashen Wolves' ? 2 : 3)
      for (const l of a.lines) expect(l.right.length, `${u.name}: ${l.text}`).toBeGreaterThan(0)
    }
    expect(FE16_TEA.topics).toHaveLength(66)
    expect(FE16_TEA.reactions).toEqual(['Nod', 'Laugh', 'Commend', 'Disagree', 'Admonish', 'Sigh', 'Chat', 'Sip tea', 'Blush', 'Praise'])
    expect(FE16_TEA.likedByAll).toEqual(['Owl Feather'])
  })

  it("matches the guides' final lines and right reactions, in order", () => {
    for (const [name, lines] of Object.entries(GUIDE_LINES)) {
      const got = byName(name).lines
      lines.forEach(([start, right], k) => {
        expect(got[k].text.startsWith(start), `${name} ${k}: ${got[k].text}`).toBe(true)
        expect([...got[k].right].sort(), `${name}: ${start}`).toEqual([...right].sort())
      })
    }
  })

  it("matches the guides' favorite teas", () => {
    for (const [name, teas] of Object.entries(GUIDE_TEAS)) expect([...byName(name).teas].sort()).toEqual([...teas].sort())
    // Edelgard's: the guide stars the Hresvelg Blend too (the best tea, a grade-4 one, fixed_materialdata.bin), but her own list is Bergamot.
    expect(byName('Edelgard').teas).toEqual(['Bergamot'])
  })

  it('keeps the gifts the game checks: liked, disliked, the flower and the lost items', () => {
    const e = byName('Edelgard')
    expect(e.likes).toEqual(['Armored Bear Stuffy', 'Monarch Studies Book', 'Board Game'])
    expect(e.dislikes).toEqual(['Goddess Statuette', 'Ceremonial Sword'])
    expect(e.flower).toBe('Carnation')
    expect(e.lostItems.map((x) => x.name)).toEqual(['White Glove', 'Time-worn Quill Pen', 'Eastern Porcelain'])
    expect(byName('Lorenz').flower).toBe('Rose')
    // A no-break space in the game's text is made plain.
    expect(byName('Claude').lostItems[1].name).toBe('Mild Stomach Poison')
  })
})

describe('Three Houses spells', () => {
  it("has the game's 38 spells, with what they're effective against and the follow-up rule the help text leaves out", () => {
    expect(Object.keys(FE16_SPELL_STATS)).toHaveLength(38)
    expect(FE16_SPELL_STATS['Excalibur'].effective).toEqual(['flying units'])
    expect(FE16_SPELL_STATS['Seraphim'].effective).toEqual(['monsters'])
    expect(FE16_SPELL_STATS['Bolting'].notes).toEqual(['Cannot make follow-up attacks.'])
    expect(FE16_SPELL_STATS['Meteor'].notes).toBeUndefined()
    expect(FE16_SPELL_STATS['Physic'].range).toBe('1 to a range from Mag')
    expect(FE16_SPELL_STATS['Quake Σ'].range).toBe('the whole map')
    expect(FE16_SPELL_STATS['Recover']).toMatchObject({ kind: 'White magic', heals: true, mt: 30, uses: 5 })
    expect(FE16_SPELL_STATS['Fire']).toMatchObject({ kind: 'Black magic', mt: 3, hit: 90, crit: 0, wt: 3, range: '1-2', uses: 10 })
    expect(FE16_SPELL_STATS['Miasma Δ'].kind).toBe('Dark magic')
  })
})
