import { APP_CONFIG } from "@ojo/shared";
import { ChatIcon, NewspaperIcon } from "@ojo/ui";
import { getT } from "@/server/i18n";
import { loadAccountSummary } from "@/server/account-summary";
import { getCurrentUser } from "@/server/session";
import { AddTrackerHost } from "@/components/trackers/add-tracker-host";
import { getFeaturedNews, listNewsPage } from "@/server/news";
import { FeedbackForm } from "./feedback-form";
import { Faq } from "./faq";
import { FinalCta } from "./final-cta";
import { LandingFooter } from "./footer";
import { LandingHeader } from "./landing-header";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { NewsFeed } from "./news-feed";
import { SectionTitle } from "./section-title";
import { Pricing } from "./pricing";
import { Problem } from "./problem";
import { SourcesStrip } from "./sources-strip";
import { StatusSection } from "./status-section";

/** The public home page: pitch, how it works, prices, news, questions. */
export async function LandingPage() {
  const { t, locale } = await getT();
  const user = await getCurrentUser();
  const signedIn = user !== null;
  const summary = user ? await loadAccountSummary(user) : null;
  const featuredNews = await getFeaturedNews(locale);
  const news = await listNewsPage(locale, 1, APP_CONFIG.news.pageSize, featuredNews?.slug);

  return (
    <div id="top">
      <LandingHeader
        t={t}
        user={
          user && summary
            ? {
                email: user.email,
                name: user.firstName,
                stats: summary.cabinetReady
                  ? { paid: summary.paid, used: summary.used, free: summary.free, price: summary.price, currency: summary.currency }
                  : null,
              }
            : null
        }
      />
      {summary?.cabinetReady && (
        <AddTrackerHost
          defaultJurisdiction={summary.defaultJurisdiction}
          lock={summary.addLock}
          usage={summary.usage}
          defaultBirthDate={summary.defaultBirthDate}
        />
      )}
      <main>
        <Hero t={t} signedIn={signedIn} />
        <SourcesStrip t={t} />
        <Problem t={t} />
        <HowItWorks />
        <StatusSection t={t} />
        <Pricing t={t} locale={locale} signedIn={signedIn} />
        <section id="news" className="scroll-mt-20 mx-auto max-w-6xl space-y-6 px-4 pb-16">
          <SectionTitle icon={NewspaperIcon}>{t("landing.news.title")}</SectionTitle>
          {/* the feed keeps its own list: a new language needs a fresh one */}
          <NewsFeed key={locale} featured={featuredNews} initial={news} />
        </section>
        <Faq t={t} />
        <section id="feedback" className="scroll-mt-20 mx-auto max-w-3xl space-y-4 px-4 py-16">
          <div className="space-y-1">
            <SectionTitle icon={ChatIcon}>{t("feedback.title")}</SectionTitle>
            <p className="text-fg-muted">{t("feedback.subtitle")}</p>
          </div>
          <FeedbackForm defaultEmail={user?.email ?? ""} />
        </section>
        <FinalCta t={t} signedIn={signedIn} />
      </main>
      <LandingFooter t={t} />
    </div>
  );
}
