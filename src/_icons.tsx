/* HireStepX — shared icon atoms.
 *
 * Replaces the dozen+ duplicated inline <svg> blocks for check / info /
 * spinner that drifted across Interview, Dashboard, SessionSetup,
 * ResetPassword, and onboarding. Stroke width converged to 2 for
 * emphasis icons and 1.5 for outlines so we stop shipping 7 distinct
 * weights for the same glyph.
 *
 * All icons are sized via the `size` prop, inherit `currentColor`, and
 * are `aria-hidden` by default. Pass `title` for accessible labelling.
 */

import { memo } from "react";

type IconProps = {
  size?: number;
  strokeWidth?: number;
  color?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
};

function base(props: IconProps, child: React.ReactNode) {
  const { size = 16, strokeWidth = 2, color = "currentColor", title, className, style } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      className={className}
      style={style}
    >
      {title ? <title>{title}</title> : null}
      {child}
    </svg>
  );
}

export const CheckIcon = memo(function CheckIcon(props: IconProps) {
  return base(props, <polyline points="20 6 9 17 4 12" />);
});

export const InfoIcon = memo(function InfoIcon(props: IconProps) {
  return base(props, <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </>);
});

export const SpinnerIcon = memo(function SpinnerIcon(props: IconProps) {
  return base(props, <>
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M22 12a10 10 0 0 1-10 10" />
  </>);
});

export const ArrowRightIcon = memo(function ArrowRightIcon(props: IconProps) {
  return base(props, <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>);
});

export const XIcon = memo(function XIcon(props: IconProps) {
  return base(props, <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>);
});
