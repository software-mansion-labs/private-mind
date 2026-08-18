import React, { useEffect, useRef } from 'react';
import { DEFAULT_BRAND_SERVICE_URL, useBrandLogos } from './swm-brands';

const ITEM_WIDTH = 160;
const ITEM_HEIGHT = 70;
const RADIUS = 1600;
const DURATION = 120;
const ITEM_GAP_DEG = 5;
const ORBIT_VISIBLE_RATIO = 0.22;
const ARC_PX_PER_GAP_DEG = 12;
const DRAG_THRESHOLD = 6;
const MARGIN_TOP = '-200px';

const SPINNER = {
  track: 'rgba(13, 15, 38, 0.12)',
  head: 'rgba(13, 15, 38, 0.55)',
};

const wrapDeg = (deg: number) => {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
};

const formatDeg = (deg: number) =>
  `${(Math.round(wrapDeg(deg) * 100) / 100).toFixed(2)}deg`;

const formatPx = (px: number) =>
  `${(Math.round(px * 1000) / 1000).toFixed(3)}px`;

function BrandStrip() {
  const { brands, loading } = useBrandLogos(DEFAULT_BRAND_SERVICE_URL);
  const wheelRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const pressedRef = useRef(false);
  const didDragRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastAngleRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const autoPerMs = 360 / DURATION / 1000;
    const tick = (now: number) => {
      const dt = Math.min(now - prev, 64);
      prev = now;
      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 0.02) {
          rotationRef.current = wrapDeg(
            rotationRef.current + velocityRef.current
          );
          velocityRef.current *= 0.92;
        } else if (!pausedRef.current) {
          rotationRef.current = wrapDeg(rotationRef.current + autoPerMs * dt);
        }
      }
      wheelRef.current?.style.setProperty(
        '--wheel-rot',
        formatDeg(rotationRef.current)
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const getPointerAngle = (clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return (
      Math.atan2(
        clientY - (r.top + r.height / 2),
        clientX - (r.left + r.width / 2)
      ) *
      (180 / Math.PI)
    );
  };

  const onItemPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    pressedRef.current = true;
    didDragRef.current = false;
    velocityRef.current = 0;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
  };

  const onItemPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!pressedRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (!draggingRef.current) {
      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      draggingRef.current = true;
      didDragRef.current = true;
      lastAngleRef.current = getPointerAngle(e.clientX, e.clientY);
      return;
    }
    const angle = getPointerAngle(e.clientX, e.clientY);
    let delta = angle - lastAngleRef.current;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
    rotationRef.current = wrapDeg(rotationRef.current + delta);
    velocityRef.current = delta;
    lastAngleRef.current = angle;
  };

  const onItemPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    pressedRef.current = false;
    draggingRef.current = false;
    if (el.hasPointerCapture?.(e.pointerId)) {
      el.releasePointerCapture?.(e.pointerId);
    }
  };

  const onItemClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const items = brands
    .filter((brand) => brand.onLightExact)
    .map((brand) => ({
      src: brand.onLight,
      alt: brand.alt,
      href: brand.href,
    }));

  if (loading) {
    return (
      <output
        className="brand-strip-loading"
        style={{ minHeight: ITEM_HEIGHT * 2 }}
        aria-label="Loading product logos"
      >
        <span
          className="brand-strip-spinner"
          style={{
            borderColor: SPINNER.track,
            borderTopColor: SPINNER.head,
          }}
        />
      </output>
    );
  }

  const logoNodes = items.map((item) => {
    const logo = (
      <img
        src={item.src}
        alt={item.alt}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="brand-strip-logo"
      />
    );
    return (
      <div
        key={item.alt}
        className="brand-strip-slot"
        style={{ width: ITEM_WIDTH, height: ITEM_HEIGHT }}
      >
        {item.href ? (
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          >
            {logo}
          </a>
        ) : (
          logo
        )}
      </div>
    );
  });

  const perItemArc = ITEM_WIDTH + ITEM_GAP_DEG * ARC_PX_PER_GAP_DEG;
  const capacity = Math.max(
    1,
    Math.floor((2 * Math.PI * RADIUS) / Math.max(1, perItemArc))
  );
  const repeat = Math.max(
    1,
    Math.floor(capacity / Math.max(1, logoNodes.length))
  );

  const orbitItems: React.ReactNode[] = [];
  for (let i = 0; i < repeat; i += 1) orbitItems.push(...logoNodes);
  const count = orbitItems.length;
  if (count === 0) return null;

  const visibleHeight = Math.round(RADIUS * ORBIT_VISIBLE_RATIO);
  const diameter = RADIUS * 2;
  const stepDeg = 360 / count;

  const mobilePasses = Math.max(2, repeat);
  const mobileItems: React.ReactNode[] = [];
  for (let pass = 0; pass < mobilePasses; pass += 1) {
    logoNodes.forEach((child) => {
      mobileItems.push(
        <div
          key={`mobile-${pass}-${(child as React.ReactElement).key}`}
          className="brand-strip-marquee-item"
        >
          {child}
        </div>
      );
    });
  }

  return (
    <>
      <div
        className="brand-strip-orbit brand-strip-reveal"
        style={{ height: visibleHeight, marginTop: MARGIN_TOP }}
      >
        <div
          ref={wheelRef}
          className="brand-strip-wheel"
          style={{ width: diameter, height: diameter, marginLeft: -RADIUS }}
        >
          {orbitItems.map((child, index) => {
            const angleDeg = stepDeg * index;
            const angleRad = (angleDeg * Math.PI) / 180;
            const x = Math.cos(angleRad) * RADIUS;
            const y = Math.sin(angleRad) * RADIUS;
            return (
              <div
                key={`orbit-${formatDeg(angleDeg)}`}
                className="brand-strip-orbit-item"
                style={{
                  transform: `translate3d(-50%, -50%, 0) translate3d(${formatPx(x)}, ${formatPx(y)}, 0)`,
                }}
              >
                <div
                  className="brand-strip-orbit-item-inner"
                  onPointerDown={onItemPointerDown}
                  onPointerMove={onItemPointerMove}
                  onPointerUp={onItemPointerUp}
                  onPointerCancel={onItemPointerUp}
                  onLostPointerCapture={() => {
                    pressedRef.current = false;
                    draggingRef.current = false;
                  }}
                  onClickCapture={onItemClickCapture}
                  onPointerEnter={() => {
                    pausedRef.current = true;
                  }}
                  onPointerLeave={() => {
                    pausedRef.current = false;
                  }}
                >
                  {child}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="brand-strip-marquee brand-strip-reveal">
        <div
          className="brand-strip-marquee-track"
          style={{ animationDuration: `${DURATION}s` }}
        >
          {mobileItems}
        </div>
      </div>
    </>
  );
}

export default BrandStrip;
