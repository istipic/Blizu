import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AddressSearch, resultLabel } from '../components/AddressSearch';
import { CategoryIcon } from '../components/CategoryIcon';
import { CountUp } from '../components/CountUp';
import { PersonaControl } from '../components/PersonaControl';
import { Button, Icon } from '../components/ui';
import { isIsochrone, WalkBackdrop } from '../components/WalkBackdrop';
import { formatDateTimeHr } from '../lib/dates';
import { EXAMPLES } from '../lib/examples';
import { CATEGORY_SHORT, isPersona, PERSONA_LABEL } from '../lib/labels';
import { useIsochrone } from '../lib/useIsochrone';
import { useReveal } from '../lib/useReveal';
import { useSources } from '../lib/useSources';
import type { CategoryId, GeocodeItem, PersonaId } from '../lib/types';

export function cardUrl(lat: number, lon: number, persona: PersonaId, label?: string): string {
  const params = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    persona,
  });
  if (label) params.set('q', label);
  return `/kartica?${params.toString()}`;
}

/** The address behind the hero backdrop and the "what do you reach" section (first example). */
const SHOWCASE = EXAMPLES[0];
const MINUTES = [5, 10, 15] as const;
type Minutes = (typeof MINUTES)[number];
const CATEGORIES = Object.keys(CATEGORY_SHORT) as CategoryId[];

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Upiši adresu',
    text: 'Bilo koja adresa u Gradu Zagrebu. Prijedlozi dolaze iz OpenStreetMapa (Nominatim).',
  },
  {
    title: 'Odaberi za koga',
    text: 'Opće, starija osoba, roditelj s djetetom ili invalidska kolica: mijenja se brzina hoda i put.',
  },
  {
    title: 'Vidi minute i ocjenu',
    text: 'Za devet usluga minute hoda po stvarnoj pješačkoj mreži, najbliži objekt i ukupna ocjena A–E.',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get('persona');
  const [persona, setPersona] = useState<PersonaId>(isPersona(initial) ? initial : 'opce');
  const [chosen, setChosen] = useState<GeocodeItem | null>(null);
  const [minutes, setMinutes] = useState<Minutes>(10);
  const { data: sources } = useSources();
  const iso = useIsochrone(SHOWCASE?.lat ?? 0, SHOWCASE?.lon ?? 0, persona, !!SHOWCASE);
  const isochrone = isIsochrone(iso.data) ? iso.data : undefined;
  const root = useRef<HTMLDivElement | null>(null);
  useReveal(root);

  function go(item: GeocodeItem) {
    navigate(cardUrl(item.lat, item.lon, persona, resultLabel(item)));
  }

  function backToSearch() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus({
      preventScroll: true,
    });
  }

  const counts = isochrone?.counts[String(minutes)] ?? {};
  const total = CATEGORIES.reduce((sum, c) => sum + (counts[c] ?? 0), 0);

  return (
    <div className="na-home" ref={root}>
      {/* ------------------------------------------------------------ hero */}
      <section className="na-home-hero" aria-labelledby="hero-title">
        <WalkBackdrop data={isochrone} />
        <div className="na-home-hero__inner">
          <p className="na-overline na-home-hero__over">Zagreb · pješice · otvoreni podaci</p>
          <h1 id="hero-title" className="na-display na-home-hero__title">
            Što ti je <span className="na-gradient-text">blizu?</span>
          </h1>
          <p className="na-hero__sub">
            Upiši adresu u Zagrebu i vidi koliko minuta pješice je do liječnika, ljekarne, vrtića,
            škole, prijevoza, parka i trgovine, posebno za starije, roditelje i kolica.
          </p>

          <form
            className="na-glass na-hero__card"
            onSubmit={(e) => {
              e.preventDefault();
              if (chosen) go(chosen);
            }}
          >
            <AddressSearch onSelect={setChosen} autoFocus />
            <PersonaControl value={persona} onChange={setPersona} />
            <Button type="submit" arrow disabled={!chosen} className="w-full">
              Provjeri dostupnost
            </Button>
            {chosen ? null : (
              <p className="na-muted text-center text-xs" style={{ margin: 0 }}>
                Odaberi adresu s popisa prijedloga ili isprobaj primjer ispod.
              </p>
            )}
          </form>

          {EXAMPLES.length > 0 ? (
            <section aria-labelledby="examples-title" className="grid justify-items-center gap-2">
              <h2
                id="examples-title"
                className="na-overline na-home-hero__over"
                style={{ margin: 0 }}
              >
                Isprobaj na primjeru
              </h2>
              <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
                {EXAMPLES.map((example) => (
                  <li key={example.query}>
                    <button
                      type="button"
                      className="na-chip na-home-chip"
                      onClick={() =>
                        navigate(cardUrl(example.lat, example.lon, persona, example.label))
                      }
                    >
                      <Icon name="pin" size={14} />
                      {example.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {isochrone && SHOWCASE ? (
          <figure className="na-home-legend">
            <div className="na-home-legend__bar" aria-hidden="true" />
            <div className="na-home-legend__ticks dt-num" aria-hidden="true">
              <span>0</span>
              <span>{String(isochrone.max_min / 2).replace('.', ',')} min</span>
              <span>{isochrone.max_min} min</span>
            </div>
            <figcaption>
              Pozadina: stvarne ulice do kojih se od adrese {SHOWCASE.label} stigne pješice za{' '}
              {isochrone.max_min} min ({PERSONA_LABEL[persona].toLowerCase()}), izračun Blizua.
            </figcaption>
          </figure>
        ) : null}

        <a className="na-home-scroll" href="#doseg">
          <span>Pogledaj što stigneš</span>
          <Icon name="chevron" size={18} />
        </a>
      </section>

      {/* ------------------------------------------------------------ what you reach */}
      {SHOWCASE ? (
        <section id="doseg" className="na-home-section" aria-labelledby="reach-title">
          <div className="na-home-section__inner">
            <header className="na-home-head" data-reveal>
              <p className="na-overline">Primjer: {SHOWCASE.label}</p>
              <h2 id="reach-title">Što stigneš pješice?</h2>
              <p>
                Odaberi vrijeme i osobu. Brojevi su objekti do kojih se od adrese stigne po stvarnoj
                pješačkoj mreži, a ne zračnom linijom.
              </p>
            </header>

            <div className="na-home-controls" data-reveal>
              <div role="radiogroup" aria-label="Vrijeme hoda" className="na-home-minutes">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={minutes === m}
                    className="na-home-minutes__item"
                    onClick={() => setMinutes(m)}
                  >
                    <span className="dt-num">{m}</span> min
                  </button>
                ))}
              </div>
              <PersonaControl
                value={persona}
                onChange={setPersona}
                label="Za koga računamo primjer"
                compact
              />
            </div>

            {isochrone ? (
              <>
                <p className="na-home-total" data-reveal aria-live="polite">
                  <strong>
                    <CountUp value={total} ms={700} />
                  </strong>{' '}
                  objekata u {minutes} min ({PERSONA_LABEL[persona].toLowerCase()})
                </p>
                <ul className="na-home-tiles" data-reveal>
                  {CATEGORIES.map((c) => {
                    const n = counts[c] ?? 0;
                    return (
                      <li key={c} className={n === 0 ? 'na-home-tile is-empty' : 'na-home-tile'}>
                        <span className="na-home-tile__icon">
                          <CategoryIcon category={c} size={22} />
                        </span>
                        <span className="na-home-tile__label">{CATEGORY_SHORT[c]}</span>
                        <span className="na-home-tile__value">
                          <CountUp value={n} ms={600} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="na-muted" data-reveal>
                {iso.isError
                  ? 'Primjer trenutno nije dostupan (API ne odgovara).'
                  : 'Učitavam primjer…'}
              </p>
            )}

            <div className="na-home-cta" data-reveal>
              <Button arrow onClick={backToSearch}>
                Provjeri svoju adresu
              </Button>
              <Link
                className="na-home-link"
                to={cardUrl(SHOWCASE.lat, SHOWCASE.lon, persona, SHOWCASE.label)}
              >
                Otvori kartu za {SHOWCASE.label}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ how it works */}
      <section className="na-home-section na-home-section--tint" aria-labelledby="steps-title">
        <div className="na-home-section__inner">
          <header className="na-home-head" data-reveal>
            <p className="na-overline">Kako radi</p>
            <h2 id="steps-title">Tri koraka do odgovora</h2>
          </header>
          <ol className="na-home-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="na-card na-home-step" data-reveal>
                <span className="na-home-step__n dt-num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ explainers */}
      <section className="na-home-section" aria-label="O Blizu">
        <div className="na-home-section__inner na-explainers">
          <article className="na-card na-explainer" data-reveal>
            <p className="na-overline">Što mjerimo</p>
            <h2>Minute hoda, ne zračne linije</h2>
            <p>
              Za devet usluga računamo vrijeme hoda po stvarnoj pješačkoj mreži OpenStreetMapa, s
              brzinom hoda prilagođenom osobi. Kolica koriste graf bez stepenica.
            </p>
            <p style={{ marginTop: '0.75rem' }}>
              <Link to="/metodologija">Kako računamo</Link>
            </p>
          </article>
          <article className="na-card na-explainer" data-reveal>
            <p className="na-overline">Odakle podaci</p>
            <h2>Otvoreni izvori s datumima</h2>
            {sources && sources.sources.length > 0 ? (
              <ul className="na-muted m-0 grid list-none gap-1 p-0 text-sm">
                {sources.sources.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    {s.publisher}
                    <span className="dt-num">
                      {' '}
                      · {formatDateTimeHr(s.retrieved_at) ?? 'datum nepoznat'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Popis izvora i datuma dohvaćanja nalazi se na stranici „Otvoreni podaci”.</p>
            )}
            <p style={{ marginTop: '0.75rem' }}>
              <Link to="/izvori">Svi izvori podataka</Link>
            </p>
          </article>
          <article className="na-card na-explainer" data-reveal>
            <p className="na-overline">Usporedi</p>
            <h2>Dvije adrese jedna uz drugu</h2>
            <p>Prije selidbe ili upisa u vrtić usporedi koliko je hoda do svake usluge.</p>
            <p style={{ marginTop: '0.75rem' }}>
              <Link to="/usporedi">Usporedi adrese</Link>
            </p>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------------ planners */}
      <section className="na-home-band" aria-labelledby="planner-title">
        <div className="na-home-section__inner na-home-band__inner" data-reveal>
          <div>
            <p className="na-overline na-home-hero__over">Za gradske planere</p>
            <h2 id="planner-title">Gdje bi nova ustanova pomogla najviše?</h2>
            <p>
              Karta nezadovoljene potrebe po ćelijama od 1 km² i prijedlog 1–5 novih lokacija koje
              pokrivaju najviše ljudi.
            </p>
          </div>
          <Link className="na-btn na-home-band__btn" to="/planiranje">
            Otvori planerski način
            <span className="na-btn__arrow" aria-hidden="true">
              <Icon name="arrow" size={18} />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
