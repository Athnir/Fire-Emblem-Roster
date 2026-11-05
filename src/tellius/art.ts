import { assetKeys } from '../data/assetStorage'
import { matchByStem, type GameArt, type MatchedFile, type MatchResult } from '../logic/bulkAssetImport'
import { artId } from './logic'
import type { TelliusData } from './types'

/** The file name each image is matched by: the unit's or skill's name ("ike.png", "sol.png"). */
function stemOf(gameId: string, name: string): string {
  return artId(gameId, name).slice(gameId.length + 1)
}

export function portraitEntries(data: TelliusData) {
  return data.units.map((u) => ({ id: stemOf(data.gameId, u.name), label: u.name }))
}

export function skillEntries(data: TelliusData) {
  return Object.values(data.skills).map((s) => ({ id: stemOf(data.gameId, s.name), label: s.name }))
}

export function matchPortraits(data: TelliusData, files: File[]): MatchResult {
  return matchByStem(files, portraitEntries(data), (stem) => assetKeys.portrait(`${data.gameId}/${stem}`))
}

export function matchSkills(data: TelliusData, files: File[]): MatchResult {
  return matchByStem(files, skillEntries(data), (stem) => assetKeys.skillIcon(`${data.gameId}/${stem}`))
}

/** The id a skill's icon is kept and looked up by in a game with skills whose names differ only by a "+" (Engage's Lunar Brace and
 * Lunar Brace+, Three Houses' Alert Stance and Alert Stance+): the name as a portrait's, each "+" spelled out
 * ('fe17/lunar_brace_plus'), so each keeps an icon of its own. */
export function skillIconId(gameId: string, skill: string): string {
  return artId(gameId, skill.replace(/\+/g, ' plus'))
}

export function skillIconEntries(gameId: string, skills: string[]) {
  return skills.map((s) => ({ id: skillIconId(gameId, s).slice(gameId.length + 1), label: s }))
}

/** Skill icons by file name, "+" spelled out ("lunar_brace_plus.png"). */
export function matchSkillIcons(gameId: string, skills: string[], files: File[]): MatchResult {
  return matchByStem(files, skillIconEntries(gameId, skills), (id) => assetKeys.skillIcon(`${gameId}/${id}`))
}

const pathOf = (f: File) => ((f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase().split('/')

/** A child's portrait in layers, for a game that tints children's hair (Awakening): children/<name>/base.png, the portrait without
 * hair, and children/<name>/raw.png, the hair as the game has it. */
function matchChildLayers(data: TelliusData, files: File[]): MatchResult {
  const names = new Set(portraitEntries(data).map((e) => e.id))
  const matched: MatchedFile[] = []
  const unmatched: File[] = []
  for (const file of files) {
    const parts = pathOf(file)
    const name = parts[parts.indexOf('children') + 1]
    const layer = parts[parts.length - 1].replace(/\.[^.]+$/, '')
    const id = `${data.gameId}/${name}`
    if (names.has(name) && layer === 'base') matched.push({ file, key: assetKeys.childPortraitBase(id), label: `${name} (base)` })
    else if (names.has(name) && layer === 'raw') matched.push({ file, key: assetKeys.childPortraitRaw(id), label: `${name} (hair)` })
    else unmatched.push(file)
  }
  return { matched, unmatched }
}

/** A game's own Avatar in layers, as Fates' Corrin (Awakening): avatar/<body>/base.png, the body bald, and avatar/<body>/hair<n>.png,
 * each hairstyle; stored under the game's id as Corrin's layers are. */
function matchAvatarLayers(data: TelliusData, files: File[]): MatchResult {
  const matched: MatchedFile[] = []
  const unmatched: File[] = []
  for (const file of files) {
    const parts = pathOf(file)
    const body = parts[parts.indexOf('avatar') + 1]
    const layer = parts[parts.length - 1].replace(/\.[^.]+$/, '')
    const id = `${data.gameId}/${body}`
    if (body && parts.length >= 3 && layer === 'base') matched.push({ file, key: assetKeys.corrinBase(id), label: `Avatar ${body} (base)` })
    else if (body && parts.length >= 3 && /^hair\d+$/.test(layer)) matched.push({ file, key: assetKeys.corrinHairRaw(id, layer), label: `Avatar ${body} (${layer})` })
    else unmatched.push(file)
  }
  return { matched, unmatched }
}

/** A whole folder: files under a "skills" folder are skill icons, under "children" a child's layers, under "avatar" the Avatar's, the
 * rest portraits. */
export function matchFolder(data: TelliusData, files: File[]): MatchResult {
  const isSkill = (f: File) => pathOf(f).includes('skills')
  const isLayer = (f: File) => pathOf(f).includes('children')
  const isAvatar = (f: File) => pathOf(f).includes('avatar')
  const skills = matchSkills(data, files.filter(isSkill))
  const layers = matchChildLayers(data, files.filter((f) => !isSkill(f) && isLayer(f)))
  const avatar = matchAvatarLayers(data, files.filter((f) => !isSkill(f) && !isLayer(f) && isAvatar(f)))
  const portraits = matchPortraits(data, files.filter((f) => !isSkill(f) && !isLayer(f) && !isAvatar(f)))
  return {
    matched: [...portraits.matched, ...layers.matched, ...avatar.matched, ...skills.matched],
    unmatched: [...portraits.unmatched, ...layers.unmatched, ...avatar.unmatched, ...skills.unmatched],
  }
}

/** The game's art for Bulk Upload: its folder matched as above, and every file it can hold. `layers` adds the layered portraits
 * (Awakening's children and Avatar), which the units alone don't say. */
export function telliusArt(data: TelliusData, layers: string[] = []): GameArt {
  return {
    match: (files) => matchFolder(data, files),
    expected: [
      ...new Set(portraitEntries(data).map((e) => `${e.id}.png`)),
      ...new Set(skillEntries(data).map((e) => `skills/${e.id}.png`)),
      ...layers,
    ],
  }
}
