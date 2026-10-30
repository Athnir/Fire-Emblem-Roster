import { describe, expect, it } from 'vitest'
import { FE10_DATA } from '../../../games/fe10'
import { bondsOf, learnableSkills, levelUpsIn, openSupportsOf, project, promotionsOf } from '../../../tellius/logic'
import { TELLIUS_STATS } from '../../../tellius/types'

// Serenes Forest's Radiant Dawn tables (characters/base-stats, growth-rates, recruitment; classes/maximum-stats,
// promotion-gains; miscellaneous/skills), copied here to check the data built from the game's files against them.
// Base stats: Lv, HP, Str, Mag, Skl, Spd, Lck, Def, Res, Con, Wt, Mov.
const SF_BASES: Record<string, number[]> = {"Micaiah": [1, 15, 2, 7, 8, 7, 10, 2, 4, 5, 5, 5], "Edward": [4, 19, 7, 0, 11, 12, 8, 5, 0, 7, 7, 6], "Leonardo": [4, 17, 8, 0, 12, 10, 6, 5, 4, 7, 7, 6], "Nolan": [9, 29, 12, 0, 11, 10, 7, 9, 3, 13, 13, 6], "Laura": [1, 16, 3, 8, 3, 5, 8, 2, 10, 5, 5, 5], "Sothe": [1, 35, 18, 4, 20, 20, 15, 14, 9, 8, 8, 7], "Ilyana": [12, 22, 6, 12, 12, 13, 6, 3, 9, 5, 5, 5], "Aran": [7, 24, 10, 0, 12, 10, 6, 11, 2, 11, 15, 6], "Meg": [3, 21, 10, 1, 7, 8, 8, 10, 5, 6, 12, 5], "Volug": [15, 49, 11, 2, 12, 13, 13, 9, 5, 11, 18, 7], "Tauroneo": [14, 38, 24, 12, 22, 20, 18, 21, 15, 11, 21, 6], "Jill": [14, 24, 11, 1, 12, 15, 14, 13, 3, 7, 36, 8], "Zihark": [3, 30, 17, 6, 22, 23, 11, 13, 11, 11, 11, 7], "Fiona": [9, 25, 8, 6, 8, 10, 7, 8, 6, 7, 31, 8], "Tormod": [5, 34, 13, 17, 16, 20, 14, 12, 14, 7, 7, 6], "Muarim": [19, 58, 18, 3, 14, 11, 12, 15, 9, 14, 23, 7], "Vika": [13, 38, 9, 5, 13, 15, 14, 7, 7, 6, 5, 6], "Nailah": [33, 66, 17, 5, 23, 19, 35, 16, 13, 9, 16, 7], "Rafiel": [12, 31, 1, 6, 1, 6, 31, 3, 13, 8, 5, 5], "Black Knight": [20, 70, 38, 18, 40, 30, 20, 35, 25, 13, 25, 6], "Elincia": [1, 36, 19, 17, 21, 22, 29, 18, 24, 6, 23, 9], "Marcia": [5, 34, 16, 6, 17, 20, 12, 16, 15, 7, 23, 9], "Nealuchi": [22, 53, 10, 4, 9, 18, 24, 10, 10, 7, 7, 6], "Leanne": [5, 25, 0, 3, 1, 6, 27, 2, 11, 5, 2, 5], "Haar": [11, 46, 23, 2, 24, 20, 13, 23, 7, 12, 42, 9], "Brom": [2, 36, 19, 4, 17, 16, 13, 21, 9, 11, 21, 6], "Nephenee": [1, 32, 15, 6, 19, 20, 12, 15, 14, 7, 12, 7], "Heather": [7, 32, 15, 9, 21, 25, 16, 10, 14, 7, 7, 7], "Lucia": [14, 38, 18, 10, 27, 27, 19, 14, 15, 8, 8, 7], "Lethe": [21, 51, 9, 6, 13, 12, 18, 9, 10, 6, 11, 7], "Mordecai": [16, 57, 14, 1, 9, 9, 15, 16, 4, 18, 27, 7], "Geoffrey": [15, 37, 24, 8, 23, 20, 19, 18, 15, 11, 36, 9], "Kieran": [11, 41, 21, 6, 20, 20, 16, 18, 11, 11, 36, 9], "Astrid": [2, 33, 13, 8, 16, 15, 17, 10, 14, 7, 31, 9], "Makalov": [7, 37, 18, 5, 17, 18, 20, 17, 9, 10, 35, 9], "Danved": [9, 39, 17, 8, 23, 21, 18, 15, 12, 12, 18, 7], "Calill": [6, 32, 9, 19, 18, 18, 16, 11, 17, 7, 7, 6], "Ike": [11, 44, 24, 2, 28, 23, 14, 21, 7, 12, 13, 7], "Titania": [16, 36, 25, 10, 22, 21, 19, 20, 14, 8, 33, 9], "Soren": [5, 28, 9, 23, 21, 18, 11, 9, 21, 6, 6, 6], "Mist": [1, 28, 8, 13, 13, 15, 16, 7, 16, 5, 5, 7], "Rolf": [1, 32, 17, 3, 20, 19, 13, 13, 9, 6, 7, 7], "Boyd": [8, 45, 22, 1, 20, 18, 13, 15, 8, 12, 13, 7], "Oscar": [12, 38, 20, 7, 22, 21, 18, 17, 13, 11, 36, 9], "Shinon": [13, 43, 21, 7, 28, 24, 15, 20, 14, 10, 11, 7], "Gatrie": [10, 44, 25, 5, 18, 20, 15, 24, 11, 13, 23, 6], "Rhys": [3, 27, 8, 23, 16, 14, 21, 7, 24, 9, 9, 6], "Mia": [7, 34, 17, 5, 26, 28, 18, 13, 8, 7, 7, 7], "Ranulf": [26, 55, 14, 6, 16, 15, 23, 13, 10, 9, 14, 7], "Kyza": [18, 55, 10, 3, 10, 11, 14, 10, 5, 12, 21, 7], "Lyre": [17, 47, 7, 6, 11, 11, 16, 7, 8, 6, 11, 7], "Reyson": [15, 40, 3, 5, 5, 11, 31, 6, 17, 8, 5, 6], "Janaff": [29, 57, 16, 2, 19, 17, 30, 12, 8, 6, 7, 7], "Ulki": [28, 59, 14, 3, 17, 18, 25, 11, 10, 10, 11, 7], "Sigrun": [19, 34, 18, 13, 22, 24, 28, 20, 22, 7, 23, 9], "Tanith": [16, 35, 20, 10, 21, 23, 22, 19, 20, 8, 24, 9], "Sanaki": [1, 28, 2, 33, 22, 23, 32, 10, 28, 4, 4, 6], "Skrimir": [25, 66, 19, 3, 14, 13, 24, 16, 9, 16, 26, 7], "Tibarn": [31, 68, 18, 2, 24, 20, 29, 16, 10, 14, 16, 8], "Naesala": [27, 60, 17, 7, 20, 21, 20, 13, 14, 11, 12, 7], "Pelleas": [12, 33, 13, 24, 20, 21, 14, 14, 19, 9, 9, 6], "Stefan": [8, 53, 27, 7, 37, 36, 20, 21, 16, 13, 13, 7], "Oliver": [8, 48, 22, 31, 22, 20, 28, 18, 32, 12, 12, 6], "Bastian": [10, 45, 21, 35, 27, 24, 21, 20, 32, 10, 10, 6], "Volke": [13, 52, 30, 5, 36, 35, 19, 26, 22, 11, 11, 7], "Kurthnaga": [20, 55, 15, 7, 8, 10, 21, 15, 15, 7, 12, 6], "Ena": [22, 59, 10, 15, 13, 11, 18, 13, 17, 6, 11, 5], "Caineghis": [36, 76, 22, 4, 23, 17, 30, 22, 10, 17, 27, 7], "Giffca": [36, 73, 21, 4, 22, 18, 28, 20, 11, 17, 27, 7], "Renning": [16, 56, 31, 18, 32, 29, 24, 27, 23, 11, 37, 9], "Gareth": [31, 82, 22, 5, 10, 7, 20, 21, 9, 18, 26, 5], "Nasir": [34, 74, 7, 24, 13, 8, 19, 12, 21, 11, 18, 5], "Lehran": [20, 50, 11, 40, 40, 40, 40, 23, 40, 9, 9, 6]}
const SF_GROWTHS: Record<string, number[]> = {"Micaiah": [40, 15, 80, 40, 35, 80, 20, 90], "Edward": [85, 60, 5, 65, 60, 50, 35, 20], "Leonardo": [60, 40, 15, 75, 35, 65, 35, 55], "Nolan": [60, 45, 20, 70, 60, 60, 35, 40], "Laura": [45, 20, 70, 70, 70, 50, 20, 35], "Sothe": [30, 60, 20, 80, 45, 65, 20, 30], "Ilyana": [55, 45, 50, 60, 30, 40, 30, 50], "Aran": [50, 75, 10, 75, 35, 35, 70, 25], "Meg": [60, 35, 15, 40, 65, 75, 35, 50], "Volug": [95, 25, 15, 35, 40, 90, 15, 10], "Tauroneo": [55, 40, 5, 65, 50, 20, 45, 50], "Jill": [50, 45, 15, 45, 65, 60, 35, 45], "Zihark": [55, 35, 10, 75, 70, 40, 25, 35], "Fiona": [45, 40, 15, 40, 60, 55, 55, 50], "Tormod": [50, 55, 40, 45, 55, 25, 35, 45], "Muarim": [60, 55, 5, 45, 20, 55, 35, 30], "Vika": [60, 25, 50, 60, 60, 65, 15, 65], "Nailah": [60, 30, 15, 20, 20, 45, 30, 30], "Rafiel": [60, 0, 40, 10, 20, 60, 10, 50], "Black Knight": [0, 0, 0, 0, 0, 0, 0, 0], "Elincia": [45, 65, 40, 50, 70, 60, 20, 35], "Marcia": [70, 30, 20, 40, 65, 50, 35, 35], "Nealuchi": [55, 35, 10, 40, 40, 80, 40, 25], "Leanne": [60, 0, 40, 10, 20, 80, 10, 40], "Haar": [30, 70, 5, 70, 30, 45, 65, 20], "Brom": [80, 40, 5, 40, 30, 70, 60, 25], "Nephenee": [45, 35, 15, 70, 65, 40, 35, 45], "Heather": [40, 25, 20, 50, 70, 75, 30, 40], "Lucia": [50, 25, 20, 70, 60, 30, 15, 50], "Lethe": [85, 35, 5, 30, 50, 45, 35, 20], "Mordecai": [90, 35, 10, 25, 15, 80, 45, 15], "Geoffrey": [60, 50, 10, 60, 35, 30, 30, 55], "Kieran": [75, 60, 15, 40, 30, 30, 60, 25], "Astrid": [55, 40, 20, 45, 40, 70, 30, 50], "Makalov": [55, 40, 15, 40, 75, 45, 50, 25], "Danved": [75, 40, 20, 30, 45, 60, 45, 25], "Calill": [35, 25, 45, 60, 55, 55, 15, 50], "Ike": [65, 55, 10, 60, 35, 30, 40, 15], "Titania": [60, 60, 15, 55, 50, 40, 20, 30], "Soren": [40, 25, 80, 60, 35, 35, 25, 70], "Mist": [40, 25, 45, 55, 50, 70, 25, 40], "Rolf": [85, 75, 10, 45, 45, 35, 35, 20], "Boyd": [80, 65, 5, 45, 45, 40, 50, 10], "Oscar": [50, 35, 20, 65, 60, 55, 30, 20], "Shinon": [50, 40, 15, 70, 65, 30, 45, 20], "Gatrie": [50, 60, 5, 45, 60, 30, 60, 35], "Rhys": [40, 25, 65, 35, 35, 60, 20, 75], "Mia": [70, 45, 15, 60, 65, 35, 40, 25], "Ranulf": [70, 30, 15, 40, 35, 55, 15, 10], "Kyza": [85, 40, 5, 45, 35, 50, 40, 15], "Lyre": [50, 35, 10, 65, 70, 50, 20, 30], "Reyson": [65, 5, 30, 20, 20, 60, 20, 20], "Janaff": [55, 40, 15, 45, 25, 50, 35, 10], "Ulki": [65, 25, 30, 25, 40, 35, 30, 25], "Sigrun": [40, 45, 10, 70, 25, 70, 10, 50], "Tanith": [35, 55, 15, 75, 40, 35, 40, 30], "Sanaki": [70, 40, 60, 60, 35, 55, 30, 50], "Skrimir": [90, 35, 5, 35, 25, 20, 50, 5], "Tibarn": [75, 40, 5, 10, 20, 40, 40, 20], "Naesala": [40, 45, 15, 30, 45, 55, 15, 35], "Pelleas": [35, 25, 55, 45, 60, 40, 30, 45], "Stefan": [55, 50, 20, 60, 60, 15, 40, 50], "Oliver": [65, 55, 35, 35, 45, 30, 30, 20], "Bastian": [25, 20, 30, 70, 40, 40, 25, 50], "Volke": [50, 50, 5, 60, 65, 20, 45, 15], "Kurthnaga": [95, 45, 15, 20, 35, 60, 25, 40], "Ena": [50, 20, 50, 40, 40, 35, 15, 50], "Caineghis": [50, 40, 10, 40, 20, 40, 30, 10], "Giffca": [40, 35, 10, 35, 50, 25, 30, 15], "Renning": [40, 60, 10, 50, 40, 10, 70, 20], "Gareth": [90, 40, 5, 30, 10, 65, 30, 25], "Nasir": [70, 15, 45, 35, 20, 45, 15, 40], "Lehran": [0, 0, 0, 0, 0, 0, 0, 0]}
// Recruitment: [part, chapter] ('Final' is a part's Endgame, 'F-n' Part 4's Endgame (n)).
const SF_RECRUITMENT: Record<string, [number, string]> = {"Micaiah": [1, "Prologue"], "Edward": [1, "Prologue"], "Leonardo": [1, "Prologue"], "Nolan": [1, "1"], "Laura": [1, "2"], "Sothe": [1, "2"], "Ilyana": [1, "3"], "Aran": [1, "3"], "Volug": [1, "5"], "Jill": [1, "6"], "Tauroneo": [1, "6"], "Zihark": [1, "6"], "Fiona": [1, "7"], "Tormod": [1, "7"], "Vika": [1, "7"], "Nailah": [1, "8"], "Rafiel": [1, "8"], "Black Knight": [1, "9"], "Elincia": [2, "Prologue"], "Marcia": [2, "Prologue"], "Leanne": [2, "Prologue"], "Nealuchi": [2, "Prologue"], "Haar": [2, "Prologue"], "Nephenee": [2, "1"], "Heather": [2, "1"], "Mordecai": [2, "2"], "Lethe": [2, "2"], "Geoffrey": [2, "3"], "Kieran": [2, "3"], "Astrid": [2, "3"], "Makalov": [2, "3"], "Danved": [2, "3"], "Calill": [2, "Final"], "Ike": [3, "Prologue"], "Titania": [3, "Prologue"], "Soren": [3, "Prologue"], "Mist": [3, "Prologue"], "Rolf": [3, "Prologue"], "Boyd": [3, "Prologue"], "Oscar": [3, "Prologue"], "Shinon": [3, "Prologue"], "Gatrie": [3, "Prologue"], "Rhys": [3, "Prologue"], "Mia": [3, "Prologue"], "Ranulf": [3, "4"], "Kyza": [3, "4"], "Lyre": [3, "4"], "Reyson": [3, "5"], "Janaff": [3, "7"], "Ulki": [3, "7"], "Sigrun": [3, "11"], "Tanith": [3, "11"], "Skrimir": [4, "Prologue"], "Naesala": [4, "Prologue"], "Sanaki": [4, "Prologue"], "Tibarn": [4, "2"], "Pelleas": [4, "2"], "Stefan": [4, "3"], "Oliver": [4, "4"], "Volke": [4, "5"], "Giffca": [4, "F-1"], "Kurthnaga": [4, "F-1"], "Ena": [4, "F-1"], "Renning": [4, "F-1"], "Nasir": [4, "F-4"], "Gareth": [4, "F-4"], "Lehran": [4, "F-5"], "Meg": [1, "4"], "Muarim": [1, "7"], "Brom": [2, "1"], "Lucia": [2, "2"], "Bastian": [4, "5"], "Caineghis": [4, "F-1"]}
// The caps of each unit's starting class (classes/maximum-stats), every variant Serenes lists for it (M, F, SP...).
const SF_START_CAPS: Record<string, number[][]> = {"Micaiah": [[30, 10, 20, 20, 20, 40, 10, 20]], "Edward": [[30, 20, 10, 20, 20, 30, 20, 10]], "Leonardo": [[40, 20, 10, 20, 20, 30, 20, 10]], "Nolan": [[45, 20, 5, 20, 20, 30, 20, 10]], "Laura": [[30, 10, 20, 15, 15, 35, 10, 20], [30, 10, 20, 15, 15, 40, 10, 20]], "Sothe": [[40, 22, 15, 26, 30, 40, 20, 15], [40, 21, 15, 25, 30, 40, 20, 17]], "Ilyana": [[30, 10, 20, 20, 20, 30, 10, 20], [30, 10, 20, 20, 20, 30, 10, 20]], "Aran": [[40, 20, 10, 20, 20, 30, 20, 10]], "Meg": [[40, 20, 10, 20, 20, 30, 20, 10], [40, 20, 10, 20, 20, 30, 20, 10]], "Volug": [[70, 20, 7, 23, 18, 35, 15, 10]], "Tauroneo": [[45, 27, 15, 25, 23, 30, 30, 20], [55, 34, 18, 32, 29, 30, 35, 28]], "Jill": [[40, 20, 5, 20, 20, 30, 20, 10], [40, 20, 5, 20, 20, 30, 20, 10]], "Zihark": [[40, 24, 15, 30, 30, 30, 23, 15], [40, 23, 15, 30, 30, 30, 22, 17], [53, 30, 18, 38, 38, 30, 24, 22]], "Fiona": [[40, 20, 10, 20, 20, 30, 20, 10], [40, 20, 10, 20, 20, 30, 20, 10]], "Tormod": [[40, 15, 25, 23, 25, 30, 17, 23], [40, 15, 25, 23, 25, 30, 15, 25], [48, 22, 36, 32, 29, 30, 23, 32]], "Muarim": [[75, 23, 5, 18, 15, 30, 22, 10]], "Vika": [[60, 16, 10, 19, 23, 35, 13, 17], [60, 16, 10, 19, 23, 35, 12, 18]], "Nailah": [[70, 20, 7, 24, 20, 40, 20, 15]], "Rafiel": [[60, 5, 15, 10, 15, 50, 10, 25], [60, 5, 13, 10, 16, 50, 12, 24], [60, 5, 15, 10, 15, 50, 10, 25]], "Black Knight": [[70, 40, 20, 40, 35, 30, 40, 35]], "Elincia": [[50, 30, 30, 36, 35, 40, 26, 36]], "Marcia": [[40, 24, 15, 24, 27, 35, 22, 25], [48, 30, 16, 34, 34, 35, 26, 31]], "Nealuchi": [[60, 16, 10, 19, 23, 35, 13, 17], [60, 16, 10, 19, 23, 35, 12, 18]], "Leanne": [[60, 5, 15, 10, 15, 50, 10, 25], [60, 5, 13, 10, 16, 50, 12, 24], [60, 5, 15, 10, 15, 50, 10, 25]], "Haar": [[50, 29, 5, 26, 24, 30, 26, 13], [50, 28, 5, 26, 25, 30, 25, 14], [58, 36, 8, 36, 30, 30, 35, 18]], "Brom": [[45, 28, 15, 25, 22, 30, 30, 20], [55, 35, 18, 33, 28, 30, 34, 28]], "Nephenee": [[45, 26, 15, 26, 26, 30, 25, 17], [45, 25, 15, 26, 27, 30, 24, 18], [56, 32, 18, 33, 31, 30, 31, 25]], "Heather": [[40, 22, 15, 26, 30, 40, 20, 15], [40, 21, 15, 25, 30, 40, 20, 17]], "Lucia": [[40, 24, 15, 30, 30, 30, 23, 15], [40, 23, 15, 30, 30, 30, 22, 17], [53, 30, 18, 38, 38, 30, 24, 22]], "Lethe": [[65, 18, 10, 20, 20, 30, 16, 14], [65, 18, 10, 20, 20, 30, 14, 16]], "Mordecai": [[75, 23, 5, 18, 15, 30, 22, 10]], "Geoffrey": [[45, 25, 15, 24, 24, 30, 25, 16], [45, 25, 15, 24, 24, 30, 23, 18], [58, 33, 17, 32, 30, 30, 28, 23]], "Kieran": [[45, 26, 15, 25, 23, 30, 24, 16], [45, 26, 15, 25, 25, 30, 22, 16], [58, 34, 17, 33, 29, 30, 28, 22]], "Astrid": [[45, 23, 15, 25, 24, 30, 24, 18], [40, 23, 15, 27, 26, 30, 23, 20], [58, 31, 17, 32, 31, 30, 27, 25]], "Makalov": [[45, 24, 15, 24, 25, 30, 25, 16], [58, 32, 17, 32, 31, 30, 28, 23]], "Danved": [[45, 26, 15, 26, 26, 30, 25, 17], [45, 25, 15, 26, 27, 30, 24, 18], [56, 32, 18, 33, 31, 30, 31, 25]], "Calill": [[40, 15, 25, 23, 25, 30, 17, 23], [40, 15, 25, 23, 25, 30, 15, 25], [48, 22, 36, 32, 29, 30, 23, 32]], "Ike": [[50, 27, 10, 30, 30, 30, 26, 15]], "Titania": [[45, 26, 15, 25, 23, 30, 24, 16], [45, 26, 15, 25, 25, 30, 22, 16], [58, 34, 17, 33, 29, 30, 28, 22]], "Soren": [[40, 15, 27, 23, 23, 30, 17, 23], [48, 21, 38, 32, 29, 30, 22, 32]], "Mist": [[40, 17, 24, 25, 24, 40, 18, 28]], "Rolf": [[45, 27, 10, 30, 26, 30, 24, 16], [57, 34, 13, 38, 32, 30, 29, 23]], "Boyd": [[53, 30, 5, 26, 27, 30, 23, 13], [65, 38, 8, 34, 33, 30, 28, 18]], "Oscar": [[45, 25, 15, 24, 24, 30, 25, 16], [45, 25, 15, 24, 24, 30, 23, 18], [58, 33, 17, 32, 30, 30, 28, 23]], "Shinon": [[45, 27, 10, 30, 26, 30, 24, 16], [57, 34, 13, 38, 32, 30, 29, 23]], "Gatrie": [[45, 27, 15, 25, 23, 30, 30, 20], [55, 34, 18, 32, 29, 30, 35, 28]], "Rhys": [[40, 15, 25, 22, 23, 35, 19, 30], [40, 15, 25, 22, 23, 40, 17, 32], [48, 23, 33, 27, 27, 35, 20, 38]], "Mia": [[40, 24, 15, 30, 30, 30, 23, 15], [40, 23, 15, 30, 30, 30, 22, 17], [53, 30, 18, 38, 38, 30, 24, 22]], "Ranulf": [[65, 18, 10, 20, 20, 30, 16, 14], [65, 18, 10, 20, 20, 30, 14, 16]], "Kyza": [[75, 23, 5, 18, 15, 30, 22, 10]], "Lyre": [[65, 18, 10, 20, 20, 30, 16, 14], [65, 18, 10, 20, 20, 30, 14, 16]], "Reyson": [[60, 5, 15, 10, 15, 50, 10, 25], [60, 5, 13, 10, 16, 50, 12, 24], [60, 5, 15, 10, 15, 50, 10, 25]], "Janaff": [[65, 19, 5, 23, 21, 35, 16, 12]], "Ulki": [[65, 19, 5, 23, 21, 35, 16, 12]], "Sigrun": [[40, 24, 15, 24, 27, 35, 22, 25], [48, 30, 16, 34, 34, 35, 26, 31]], "Tanith": [[40, 24, 15, 24, 27, 35, 22, 25], [48, 30, 16, 34, 34, 35, 26, 31]], "Sanaki": [[45, 20, 40, 33, 32, 40, 20, 40]], "Skrimir": [[80, 24, 5, 23, 17, 30, 23, 12], [80, 24, 5, 23, 20, 35, 23, 12]], "Tibarn": [[75, 22, 6, 25, 23, 35, 20, 14]], "Naesala": [[70, 20, 10, 22, 25, 30, 17, 19]], "Pelleas": [[40, 15, 26, 23, 24, 30, 17, 23]], "Stefan": [[55, 32, 20, 40, 40, 30, 26, 24], [50, 31, 20, 40, 40, 35, 25, 26]], "Oliver": [[50, 25, 36, 30, 30, 35, 22, 40], [45, 23, 38, 30, 31, 40, 21, 40], [50, 25, 36, 30, 30, 35, 22, 40]], "Bastian": [[50, 24, 38, 34, 32, 30, 25, 36], [50, 24, 38, 34, 32, 30, 23, 38], [45, 24, 39, 34, 30, 30, 24, 38], [50, 23, 40, 34, 32, 30, 24, 36], [50, 25, 39, 34, 31, 30, 24, 36]], "Volke": [[55, 32, 15, 40, 40, 25, 30, 25]], "Kurthnaga": [[80, 23, 12, 18, 16, 30, 23, 19]], "Ena": [[90, 25, 10, 15, 10, 30, 23, 15], [70, 20, 20, 15, 13, 30, 20, 20]], "Caineghis": [[80, 24, 5, 23, 20, 35, 23, 12]], "Giffca": [[80, 24, 5, 23, 17, 30, 23, 12], [80, 24, 5, 23, 20, 35, 23, 12]], "Renning": [[60, 34, 20, 34, 33, 30, 30, 25], [60, 36, 20, 35, 31, 30, 30, 24], [60, 34, 20, 35, 33, 30, 28, 26]], "Gareth": [[90, 25, 10, 15, 10, 30, 23, 15], [70, 20, 20, 15, 13, 30, 20, 20]], "Nasir": [[90, 10, 25, 15, 10, 30, 15, 23]], "Lehran": [[50, 25, 40, 40, 40, 40, 25, 40]]}

const unitByName = new Map(FE10_DATA.units.map((u) => [u.name, u]))
const unit = (name: string) => unitByName.get(name)!
const labelOf = (id: string) => FE10_DATA.chapters.find((c) => c.id === id)!.label

describe('Radiant Dawn units', () => {
  it('has every playable unit Serenes Forest lists, and no others', () => {
    expect(FE10_DATA.units.map((u) => u.name).sort()).toEqual(Object.keys(SF_BASES).sort())
  })

  it("matches Serenes Forest's levels, bases, Con, Wt and Mov", () => {
    // Serenes' stars mark the units whose bases a Path of Radiance save can raise; these are the bases without one.
    for (const [name, sf] of Object.entries(SF_BASES)) {
      const u = unit(name)
      const ours = [u.level, ...TELLIUS_STATS.map((s) => u.bases[s]), u.con, u.wt, FE10_DATA.classes[u.classId].mov]
      expect([name, ...ours]).toEqual([name, ...sf])
    }
  })

  it("matches Serenes Forest's growth rates", () => {
    for (const [name, sf] of Object.entries(SF_GROWTHS)) {
      expect([name, ...TELLIUS_STATS.map((s) => unit(name).growths[s])]).toEqual([name, ...sf])
    }
  })

  it("joins where Serenes Forest's recruitment page says", () => {
    for (const [name, [part, ch]] of Object.entries(SF_RECRUITMENT)) {
      const chapter =
        ch === 'Prologue' ? 'Prologue' : ch === 'Final' ? 'Endgame' : ch.startsWith('F-') ? `Endgame (${ch.slice(2)})` : `Ch.${ch}`
      expect([name, labelOf(unit(name).joinChapter)]).toEqual([name, `Part ${part} ${chapter}`])
    }
  })

  it('joins the way Serenes Forest describes', () => {
    expect(unit('Aran').join).toMatchObject({ how: 'talk', with: ['Laura'] })
    expect(unit('Tormod').join).toMatchObject({ how: 'talk', with: ['Sothe'] })
    expect(unit('Heather').join).toMatchObject({ how: 'talk', with: ['Brom', 'Nephenee'] })
    expect(unit('Haar').join).toMatchObject({ how: 'talk', with: ['Marcia'] })
    expect(unit('Janaff').join).toMatchObject({ how: 'talk', with: ['Ike', 'Reyson'] })
    expect(unit('Oliver').join).toMatchObject({ how: 'talk', with: ['Rafiel'] })
    expect(unit('Volke').join).toMatchObject({ how: 'talk', with: ['Bastian', 'Elincia'] })
    for (const name of ['Meg', 'Danved', 'Calill', 'Renning']) expect([name, unit(name).join.how]).toEqual([name, 'base'])
    // Leonardo: turn 4 (turn 3 on Easy, Normal()'s branch). Pelleas: turn 2.
    expect(unit('Leonardo').join).toMatchObject({ how: 'event', turn: 4 })
    expect(unit('Pelleas').join).toMatchObject({ how: 'event', turn: 2 })
    // Serenes has Sothe "from turn 2": the turn-2 event only walks him through a scene and off the map; turn 3's places
    // him for good (C0103.cmb). Under his `unconfirmed`.
    expect(unit('Sothe').join).toMatchObject({ how: 'event', turn: 3 })
    expect(unit('Sothe').unconfirmed).toBeDefined()
  })

  it("starts in classes with Serenes Forest's caps", () => {
    for (const [name, variants] of Object.entries(SF_START_CAPS)) {
      const caps = TELLIUS_STATS.map((s) => FE10_DATA.classes[unit(name).classId].caps[s])
      expect([name, variants.some((v) => v.join() === caps.join())]).toEqual([name, true])
    }
  })

  it("promotes with Serenes Forest's promotion gains", () => {
    // HP, Str, Mag, Skl, Spd, Lck, Def, Res (Serenes leaves Lck out: never raised).
    const gains = (jid: string) => TELLIUS_STATS.map((s) => FE10_DATA.classes[jid].gains![s])
    expect(gains('JID_SWORDMASTER')).toEqual([2, 1, 2, 1, 1, 0, 1, 2])
    expect(gains('JID_VALKYRIA')).toEqual([4, 5, 2, 2, 2, 0, 5, 2])
    expect(gains('JID_LIGHTSAGE')).toEqual([2, 3, 1, 1, 1, 0, 3, 1])
    // Third tiers: one of four sets, by physical or magical and male or female.
    const thirdTier = [
      [4, 2, 4, 2, 2, 0, 2, 4],
      [4, 3, 4, 2, 2, 0, 3, 4],
      [4, 4, 2, 2, 2, 0, 4, 2],
      [4, 5, 2, 2, 2, 0, 5, 2],
    ].map((g) => g.join())
    for (const cls of Object.values(FE10_DATA.classes)) {
      if (cls.tier !== 'master' || !cls.gains) continue
      const g = TELLIUS_STATS.map((s) => cls.gains![s]).join()
      expect([cls.name, thirdTier.includes(g)]).toEqual([cls.name, true])
    }
  })
})

describe('Radiant Dawn promotions', () => {
  it('lets a first-tier unit promote twice, with the gains each time', () => {
    const edward = unit('Edward')
    expect(promotionsOf(FE10_DATA, edward).map((c) => c.name)).toEqual(['Swordmaster', 'Trueblade'])
    const plan = { promoteAt: 20, promoteAt2: 20, targetLevel: 20 }
    expect(levelUpsIn(FE10_DATA, edward, plan)).toBe(16 + 19 + 19)
    const stages = project(FE10_DATA, edward, plan)
    expect(stages.map((s) => `${FE10_DATA.classes[s.classId].name} ${s.level}`)).toEqual([
      'Myrmidon 4',
      'Myrmidon 20',
      'Swordmaster 1',
      'Swordmaster 20',
      'Trueblade 1',
      'Trueblade 20',
    ])
    // Promoting adds Swordmaster's gains to the (capped) Myrmidon stats.
    const [, before, after] = stages
    expect(after.stats.hp).toBeCloseTo(Math.min(before.stats.hp + 2, 40))
    expect(after.stats.mag).toBeCloseTo(before.stats.mag + 2)
  })

  it('takes laguz to level 40 and never promotes them', () => {
    const lethe = unit('Lethe')
    expect(promotionsOf(FE10_DATA, lethe)).toEqual([])
    expect(levelUpsIn(FE10_DATA, lethe, { promoteAt: null, targetLevel: 40 })).toBe(40 - lethe.level)
  })

  it('knows the story promotions', () => {
    expect(unit('Micaiah').storyPromotions?.map((p) => labelOf(p.chapter))).toEqual(['Part 1 Endgame', 'Part 4 Endgame (1)'])
    expect(FE10_DATA.classes[unit('Ike').classId].storyPromotion).toBe(true)
  })
})

describe('Radiant Dawn skills', () => {
  const can = (name: string, skill: string) =>
    learnableSkills(FE10_DATA, unit(name), unit(name).classId).map((id) => FE10_DATA.skills[id].name).includes(skill)

  it("follows Serenes Forest's notes on who can learn what", () => {
    // Beorc only.
    for (const skill of ['Shade', 'Discipline', 'Disarm', 'Corrosion', 'Stillness']) {
      expect([skill, can('Edward', skill), can('Lethe', skill)]).toEqual([skill, true, false])
    }
    // Herons only.
    expect([can('Reyson', 'Blessing'), can('Lethe', 'Blessing'), can('Ike', 'Blessing')]).toEqual([true, false, false])
    // Laguz but not herons.
    expect([can('Lethe', 'Wildheart'), can('Reyson', 'Wildheart'), can('Ike', 'Wildheart')]).toEqual([true, false, false])
    // Dragons only: Kurthnaga (Ena carries Boon already).
    expect([can('Kurthnaga', 'Boon'), can('Lethe', 'Boon')]).toEqual([true, false])
    expect([can('Elincia', 'Mercy'), can('Ike', 'Mercy')]).toEqual([true, false])
    expect([can('Janaff', 'Shriek'), can('Lethe', 'Shriek')]).toEqual([true, false])
    // Anyone.
    expect([can('Ike', 'Celerity'), can('Lethe', 'Celerity')]).toEqual([true, true])
  })

  it("has Serenes Forest's capacities and mastery skills", () => {
    const capacity = (name: string) => Object.values(FE10_DATA.skills).find((s) => s.name === name)!.capacity
    expect([capacity('Vantage'), capacity('Miracle'), capacity('Guard'), capacity('Celerity'), capacity('Aether')]).toEqual([
      10, 5, 20, 15, 30,
    ])
    const mastery = (jid: string) => FE10_DATA.skills[FE10_DATA.classes[jid].mastery!].name
    expect([mastery('JID_VANGUARD'), mastery('JID_SWORDESCHATOS'), mastery('JID_BEASTTRIBE_W'), mastery('JID_DARKKNIGHT')]).toEqual([
      'Aether',
      'Astra',
      'Savage',
      'Eclipse',
    ])
  })
})

describe('Radiant Dawn armies and supports', () => {
  const army = (chapter: string) =>
    FE10_DATA.units
      .filter((u) => u.available?.includes(chapter))
      .map((u) => u.name)
      .sort()

  it('follows the armies from part to part', () => {
    // Part 1 Ch.9: Micaiah alone, with the Black Knight.
    expect(army('fe10-1-9')).toEqual(['Black Knight', 'Micaiah'])
    // Part 2 Ch.1: Brom, Nephenee and Heather (Elincia's army is elsewhere).
    expect(army('fe10-2-1')).toEqual(['Brom', 'Heather', 'Nephenee'])
    // The last map: everyone but the Black Knight, who leaves in Part 3.
    expect(army('fe10-4-endgame-5')).toEqual(
      FE10_DATA.units
        .map((u) => u.name)
        .filter((n) => n !== 'Black Knight')
        .sort(),
    )
  })

  it('pairs everyone in the support list, at the pace RelianceParam gives each kind', () => {
    expect(FE10_DATA.openSupports!.pool).toHaveLength(71)
    expect(FE10_DATA.openSupports!.levels).toEqual([50, 100, 150])
    const ike = openSupportsOf(FE10_DATA, 'PID_IKE')
    expect(ike).toHaveLength(70)
    expect(ike.find((p) => p.partner.name === 'Mist')!.bonus).toBe(2)
    expect(ike.find((p) => p.partner.name === 'Shinon')!.bonus).toBe(-1)
    expect(
      bondsOf(FE10_DATA, 'PID_IKE')
        .map((b) => b.partner.name)
        .sort(),
    ).toEqual(['Mist', 'Ranulf', 'Soren', 'Titania'])
  })
})
