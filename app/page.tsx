import HeroSection from '@/components/sections/HeroSection'
import StatisticsSection from '@/components/sections/StatisticsSection'
import ServicesSection from '@/components/sections/ServicesSection'
import OperationsSection from '@/components/sections/OperationsSection'
import QualityProofSection from '@/components/sections/QualityProofSection'
import BusinessCTASection from '@/components/sections/BusinessCTASection'
import LocationsSection from '@/components/sections/LocationsSection'
import CareerTeaserSection from '@/components/sections/CareerTeaserSection'
import CompanyStorySection from '@/components/sections/CompanyStorySection'
import FinalCTASection from '@/components/sections/FinalCTASection'
import { getHeroMedia } from '@/lib/assets'

export default function Home() {
  const heroMedia = getHeroMedia()

  return (
    <>
      <HeroSection media={heroMedia} />
      <StatisticsSection />
      <ServicesSection />
      <OperationsSection />
      <QualityProofSection />
      <BusinessCTASection />
      <LocationsSection />
      <CareerTeaserSection />
      <CompanyStorySection />
      <FinalCTASection />
    </>
  )
}
