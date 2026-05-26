export interface LabBoardFailure {
  readonly mat: string
  readonly matNo: string
  readonly lot: string
  readonly batch: string
  readonly line: string
  readonly char: string
  readonly text: string
  readonly res: number
  readonly lo: number
  readonly hi: number
  readonly units: string
  readonly sev: 'fail' | 'warn'
}

/** Static lab-board failures imported from the Claude Design standalone HTML. */
export const LAB_BOARD_FAILURES: readonly LabBoardFailure[] = [
  { mat: 'LIME OIL EXP TAHITI LHC LLE 10KG', matNo: '20616727', lot: '040005198449 [1]', batch: '0011874817', line: 'P806 - NPD - DISTILLATION', char: 'E_SPECG1', text: 'Specific Gravity 25C', res: 0.8821, lo: 0.8870, hi: 0.8930, units: 'g/cc', sev: 'fail' },
  { mat: 'LIME OIL EXP TAHITI LHC LLE 10KG', matNo: '20616727', lot: '040005198449 [1]', batch: '0011874817', line: 'P806 - NPD - DISTILLATION', char: 'E_REFRAC', text: 'Refractive Index 20C', res: 1.4801, lo: 1.4820, hi: 1.4870, units: 'n', sev: 'fail' },
  { mat: 'N&A PUMPKIN SPICE TYPE FL 22.68KG', matNo: '20704112', lot: '040005198512 [1]', batch: '0011874901', line: 'P802 - BLENDING - LINE 2', char: 'E_MOIST', text: 'Moisture %', res: 4.82, lo: 0.00, hi: 4.50, units: '%', sev: 'fail' },
  { mat: 'N&A PUMPKIN SPICE TYPE FL 22.68KG', matNo: '20704112', lot: '040005198512 [1]', batch: '0011874901', line: 'P802 - BLENDING - LINE 2', char: 'E_PARTD50', text: 'Particle D50', res: 102, lo: 80, hi: 100, units: 'um', sev: 'warn' },
  { mat: 'WPC-80 INSTANT 1KG POUCH', matNo: '20582002', lot: '040005198601 [2]', batch: '0008898869', line: 'P404 - DRYER - LINE 4', char: 'E_BULKD', text: 'Bulk Density', res: 0.36, lo: 0.38, hi: 0.46, units: 'g/cc', sev: 'fail' },
  { mat: 'WPC-80 INSTANT 1KG POUCH', matNo: '20582002', lot: '040005198601 [2]', batch: '0008898869', line: 'P404 - DRYER - LINE 4', char: 'E_OUTTMP', text: 'Outlet Temp', res: 92.4, lo: 78.0, hi: 88.0, units: 'deg C', sev: 'fail' },
  { mat: 'ORANGE OIL VALENCIA COLD PRESS', matNo: '20619841', lot: '040005198688 [1]', batch: '0011875204', line: 'P806 - NPD - DISTILLATION', char: 'E_ALDEHY', text: 'Aldehydes %', res: 1.42, lo: 1.20, hi: 2.50, units: '%', sev: 'warn' },
  { mat: 'VANILLA EXTRACT NAT 1X (FOLD)', matNo: '20617025', lot: '040005198741 [1]', batch: '0011875310', line: 'P802 - BLENDING - LINE 2', char: 'E_VANILLIN', text: 'Vanillin Conc.', res: 11.8, lo: 13.0, hi: 14.5, units: 'g/L', sev: 'fail' },
]
