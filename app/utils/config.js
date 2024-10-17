import { http, createConfig } from 'wagmi'
import { gnosis } from 'wagmi/chains'

export const config = createConfig({
  chains: [gnosis],
  transports: {
    [gnosis.id]: http(),
  },
})