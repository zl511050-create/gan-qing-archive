import type { Metadata } from "next";
import { DeepSeaGame } from "@/components/deep-sea-game";

export const metadata: Metadata = {
  title: "深海垂钓｜未寄",
  description: "潜入五百米深海，带着沿途遇见的微光平安返航。",
};

export default function GamePage() {
  return <DeepSeaGame />;
}
