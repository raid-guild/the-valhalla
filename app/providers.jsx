"use client";

import { ChakraProvider, createSystem, defaultConfig } from "@chakra-ui/react";

const breakpoints = {
  base: "320px",
  md: "620px",
  lg: "1020px",
};

const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      breakpoints,
    },
  },
});

export function Providers({ children }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
