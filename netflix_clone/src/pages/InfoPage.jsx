import { useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'
import { infoLabel } from '../data/infoPages.js'
import { AiIntegration } from './info/AiIntegration.jsx'
import { DoNotSell } from './info/DoNotSell.jsx'
import { Faqs } from './info/Faqs.jsx'
import { Feedback } from './info/Feedback.jsx'
import { Legal } from './info/Legal.jsx'
import { Promotions } from './info/Promotions.jsx'
import { ReportIssue } from './info/ReportIssue.jsx'
import { Support } from './info/Support.jsx'
import { TechRequirements } from './info/TechRequirements.jsx'
import { NotFound } from './NotFound.jsx'

const pages = {
  support: <Support />,
  faqs: <Faqs />,
  feedback: <Feedback />,
  'report-issue': <ReportIssue />,
  promotions: <Promotions />,
  'tech-requirements': <TechRequirements />,
  ai: <AiIntegration />,
  terms: <Legal doc="terms" />,
  privacy: <Legal doc="privacy" />,
  'do-not-sell': <DoNotSell />,
}

export function InfoPage() {
  const { slug } = useParams()
  if (!pages[slug]) return <NotFound />

  return (
    <>
      <PageHeader title={infoLabel(slug)} back />
      {pages[slug]}
    </>
  )
}
