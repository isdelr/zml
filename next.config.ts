import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
     remotePatterns: [new URL('https://sp.universal-music.co.jp/moricalliope/sinderella/common/images/main01_sp.png'), new URL('https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w')]
  }
};

export default nextConfig;
