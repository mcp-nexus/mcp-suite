import type { Domain } from '../../types'
import { config } from '../../config'

export const devtoolsDomain: Domain = {
  name: 'devtools',
  isAvailable: () => !!config.GITHUB_TOKEN,
  registerTools: (_server) => {
    // Tools registered in Phase 6
  },
}
