import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AddressSearch, resultLabel } from '../components/AddressSearch';
import { PersonaControl } from '../components/PersonaControl';
import { Button, Icon } from '../components/ui';
import { isIsochrone, WalkBackdrop } from '../components/WalkBackdrop';
import { EXAMPLES } from '../lib/examples';
import { isPersona, PERSONA_LABEL } from '../lib/labels';
import { useIsochrone } from '../lib/useIsochrone';
import type { GeocodeItem, PersonaId } from '../lib/types';

export function cardUrl(lat: number, lon: number, persona: PersonaId, label?: string): string {
  const params = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    persona,
  });
  if (label) params.set('q', label);
  return `/kartica?${params.toString()}`;
}

/** The address behind the hero backdrop (first example). */
const SHOWCASE = EXAMPLES[0];

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get('persona');
  const [persona, setPersona] = useState<PersonaId>(isPersona(initial) ? initial : 'opce');
  const [chosen, setChosen] = useState<GeocodeItem | null>(null);
  const iso = useIsochrone(SHOWCASE?.lat ?? 0, SHOWCASE?.lon ?? 0, persona, !!SHOWCASE);
  const isochrone = isIsochrone(iso.data) ? iso.data : undefined;

  function go(item: GeocodeItem) {
    navigate(cardUrl(item.lat, item.lon, persona, resultLabel(item)));
  }

  return (
    <div className="na-home">
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
      </section>
    </div>
  );
}
