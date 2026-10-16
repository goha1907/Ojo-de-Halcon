import { APP_CONFIG } from "@ojo/shared";
import { getT } from "@/server/i18n";
import { getCurrentUser } from "@/server/session";
import { listNewsPage } from "@/server/news";
import { FeedbackForm } from "./feedback-form";
import { Faq } from "./faq";
import { FinalCta } from "./final-cta";
import { LandingFooter } from "./footer";
import { LandingHeader } from "./landing-header";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { NewsFeed } from "./news-feed";
import { Pricing } from "./pricing";
import { Problem } from "./problem";

/** The public home page: pitch, how it works, prices, news, questions. */
export async function LandingPage() {
  const { t, locale } = await getT();
  const user = await getCurrentUser();
  const signedIn = user !== null;
  const news = await listNewsPage(locale, 1, APP_CONFIG.news.pageSize);

  return (
    <div id="top">
      <LandingHeader t={t} signedIn={signedIn} />
      <main>
        <Hero t={t} signedIn={signedIn} />
        <Problem t={t} />
        <HowItWorks />
        <Pricing t={t} locale={locale} signedIn={signedIn} />
        <section id="news" className="scroll-mt-20 mx-auto max-w-3xl space-y-4 px-4 pb-16">
          <h2 className="text-2xl font-bold text-fg">{t("landing.news.title")}</h2>
          <NewsFeed initial={news} />
        </section>
        <Faq t={t} />
        <section id="feedback" className="scroll-mt-20 mx-auto max-w-3xl space-y-4 px-4 py-16">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-fg">{t("feedback.title")}</h2>
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
