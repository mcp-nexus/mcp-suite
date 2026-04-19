import type { Domain } from '../../types'

export const healthcareDomain: Domain = {
  name: 'healthcare',
  isAvailable: () => true,
  registerTools: (_server) => {
    // Tools registered in Phase 7
  },
}
