import type { Domain } from '../../types'
import { config } from '../../config'

export const web3Domain: Domain = {
  name: 'web3',
  isAvailable: () => !!config.ALCHEMY_API_KEY && !!config.OPENSEA_API_KEY,
  registerTools: (_server) => {
    // Tools registered in Phase 4
  },
}
