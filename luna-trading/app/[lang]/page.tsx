import Hero from "@/components/sections/Hero";
import SourceToMarket from "@/components/sections/SourceToMarket";
import Transport from "@/components/sections/Transport";
import Warehouse from "@/components/sections/Warehouse";
import BrandShift from "@/components/sections/BrandShift";
import Chain from "@/components/sections/Chain";
import Commerce from "@/components/sections/Commerce";
import Luviscent from "@/components/sections/Luviscent";
import Ecosystem from "@/components/sections/Ecosystem";
import Closing from "@/components/sections/Closing";
import Atmosphere from "@/components/chrome/Atmosphere";
import Loader from "@/components/chrome/Loader";
import ProgressRail from "@/components/chrome/ProgressRail";
import GlobeLayer from "@/components/stage/GlobeLayer";
import WorldLayer from "@/components/stage/WorldLayer";


/**
 * HOME — one continuous story:
 * WORLD → TRADE → FREIGHT → TRANSPORT → WAREHOUSE → PRODUCT → BRAND →
 * E-COMMERCE → LUVISCENT → ECOSYSTEM → WORLD
 *
 * Fixed render layers (Atmosphere, Globe, World) sit behind chapter stages.
 * Three.js code for both layers is split into separate async chunks.
 */
export default function HomePage() {
  return (
    <>
      <Atmosphere />
      <GlobeLayer />
      <WorldLayer />
      <Loader />
      <ProgressRail />
      <Hero />
      <SourceToMarket />
      <Transport />
      <Warehouse />
      <BrandShift />
      <Chain />
      <Commerce />
      <Luviscent />
      <Ecosystem />
      <Closing />
    </>
  );
}
