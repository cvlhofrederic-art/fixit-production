/** Agrège les exceptions déclarées par lot de modules (un fichier par lot : pas d'édition concurrente). */
import { AUTORISES as L01 } from './lot-01'
import { AUTORISES as L02 } from './lot-02'
import { AUTORISES as L03 } from './lot-03'
import { AUTORISES as L04 } from './lot-04'
import { AUTORISES as L05 } from './lot-05'
import { AUTORISES as L06 } from './lot-06'
import { AUTORISES as L07 } from './lot-07'
import { AUTORISES as L08 } from './lot-08'
import { AUTORISES as L09 } from './lot-09'
import { AUTORISES as L10 } from './lot-10'
import { AUTORISES as L11 } from './lot-11'
import { AUTORISES as L12 } from './lot-12'
import { AUTORISES as L13 } from './lot-13'
import { AUTORISES as L14 } from './lot-14'
import { AUTORISES as L15 } from './lot-15'
import { AUTORISES as L16 } from './lot-16'

export const AUTORISES_PAR_LOT: readonly string[] = [...L01, ...L02, ...L03, ...L04, ...L05, ...L06, ...L07, ...L08, ...L09, ...L10, ...L11, ...L12, ...L13, ...L14, ...L15, ...L16]
