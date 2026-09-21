import CurrentCard from './CurrentCard.jsx';
import HourlyCard from './HourlyCard.jsx';
import AdvisoryNote from './AdvisoryNote.jsx';
import DailyCard from './DailyCard.jsx';
import AlertsCard from './AlertsCard.jsx';
import AqiCard from './AqiCard.jsx';
import ClimateCard from './ClimateCard.jsx';
import ModelsCard from './ModelsCard.jsx';
import SectorCard from './SectorCard.jsx';
import RainCard from './RainCard.jsx';
import DaySummaryCard from './DaySummaryCard.jsx';
import Capabilities from './Capabilities.jsx';

/**
 * Maps a typed block from the orchestrator onto a component.
 *
 * Keeping this dispatch in one place means a new answer type needs a card and
 * one line here — the chat transcript itself stays agnostic.
 */
export default function BlockRenderer({ block, lang }) {
  switch (block.type) {
    case 'current':
      return <CurrentCard place={block.place} forecast={block.forecast} air={block.air} lang={lang} />;
    case 'hourly':
      return (
        <HourlyCard
          forecast={block.forecast}
          hours={block.hours}
          startAtDay={block.startAtDay}
          lang={lang}
        />
      );
    case 'advisory':
      return <AdvisoryNote advisory={block.advisory} />;
    case 'daily':
      return <DailyCard forecast={block.forecast} lang={lang} highlight={block.highlight} />;
    case 'daySummary':
      return <DaySummaryCard day={block.day} dayIndex={block.dayIndex} lang={lang} />;
    case 'alerts':
      return <AlertsCard warnings={block.warnings} lang={lang} compact={block.compact} />;
    case 'aqi':
      return <AqiCard air={block.air} place={block.place} lang={lang} />;
    case 'climate':
      return (
        <ClimateCard
          climate={block.climate}
          place={block.place}
          monthToDate={block.monthToDate}
          lang={lang}
        />
      );
    case 'models':
      return <ModelsCard comparison={block.comparison} place={block.place} lang={lang} />;
    case 'sector':
      return <SectorCard advisory={block.advisory} lang={lang} />;
    case 'rain':
      return (
        <RainCard
          forecast={block.forecast}
          dayIndex={block.dayIndex}
          willRain={block.willRain}
          lang={lang}
        />
      );
    case 'capabilities':
      return <Capabilities lang={lang} />;
    default:
      return null;
  }
}
