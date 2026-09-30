import { BusinessTeaser } from "@/sections/home/BusinessTeaser";
import { CareersTeaser } from "@/sections/home/CareersTeaser";
import { Hero } from "@/sections/home/Hero";
import { JourneySequence } from "@/sections/home/journey/JourneySequence";
import { LocationsTeaser } from "@/sections/home/LocationsTeaser";
import { OperatingModel } from "@/sections/home/OperatingModel";
import { Partners } from "@/sections/home/Partners";
import { Performance } from "@/sections/home/Performance";
import { Services } from "@/sections/home/Services";

export default function HomePage() {
  return (
    <>
      <Hero />
      <JourneySequence />
      <Services />
      <OperatingModel />
      <Performance />
      <LocationsTeaser />
      <Partners />
      <CareersTeaser />
      <BusinessTeaser />
    </>
  );
}
