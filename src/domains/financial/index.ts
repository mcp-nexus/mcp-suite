import type { Domain } from '../../types'
import { config } from '../../config'

export const financialDomain: Domain = {
  name: 'financial',
  isAvailable: () => !!config.ALPHA_VANTAGE_API_KEY,
  registerTools: (_server) => {
    // Tools registered in Phase 5
  },
}
