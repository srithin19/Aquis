/**
 * Tab-bar and inline icons.
 *
 * Hand-drawn paths rather than an icon package: the set is small and these
 * match the rounded, soft line weight of the rest of the interface.
 */

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'drop'
  | 'calendar'
  | 'medal'
  | 'person'
  | 'plus'
  | 'minus'
  | 'bell'
  | 'bellOff'
  | 'flame'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'close'
  | 'sparkle'
  | 'lock';

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, strokeWidth = 1.9 }: IconProps) {
  const s = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'drop' && <Path d="M12 3c0 0 6 6.8 6 10.4A6 6 0 0 1 6 13.4C6 9.8 12 3 12 3Z" {...s} />}
      {name === 'calendar' && (
        <>
          <Path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-12Z" {...s} />
          <Path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3" {...s} />
        </>
      )}
      {name === 'medal' && (
        <>
          <Circle cx={12} cy={14.5} r={5} {...s} />
          <Path d="M8.5 9.8 6 3.5h12l-2.5 6.3" {...s} />
        </>
      )}
      {name === 'person' && (
        <>
          <Circle cx={12} cy={8} r={3.6} {...s} />
          <Path d="M4.8 20c.6-3.7 3.6-5.8 7.2-5.8s6.6 2.1 7.2 5.8" {...s} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5.5v13M5.5 12h13" {...s} />}
      {name === 'minus' && <Path d="M5.5 12h13" {...s} />}
      {name === 'bell' && (
        <>
          <Path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3.2.8 4.7 1.5 5.5h-14c.7-.8 1.5-2.3 1.5-5.5Z" {...s} />
          <Path d="M10 18.5a2 2 0 0 0 4 0" {...s} />
        </>
      )}
      {name === 'bellOff' && (
        <>
          <Path d="M6.5 10a5.5 5.5 0 0 1 8-4.9M17.5 11.5c.1 2.6.8 3.9 1.5 4.5h-11" {...s} />
          <Path d="M4 4l16 16" {...s} />
        </>
      )}
      {name === 'flame' && (
        <Path d="M12 3.5s4.5 3.8 4.5 8a4.5 4.5 0 0 1-9 0c0-1.4.6-2.6 1.3-3.5.2 1.2.9 2 1.7 2 .9 0 1.5-.8 1.5-2.2 0-1.4-.5-2.8-.5-4.3Z" {...s} />
      )}
      {name === 'check' && <Path d="M5 12.5 10 17.5 19 7" {...s} />}
      {name === 'chevronLeft' && <Path d="M14.5 5.5 8 12l6.5 6.5" {...s} />}
      {name === 'chevronRight' && <Path d="M9.5 5.5 16 12l-6.5 6.5" {...s} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6 6 18" {...s} />}
      {name === 'sparkle' && (
        <Path d="M12 3.5 13.7 9l5.3 1.7-5.3 1.7L12 18l-1.7-5.6L5 10.7 10.3 9 12 3.5Z" {...s} />
      )}
      {name === 'lock' && (
        <>
          <Path d="M6.5 10.5h11v9h-11v-9Z" {...s} />
          <Path d="M9 10.5V8a3 3 0 0 1 6 0v2.5" {...s} />
        </>
      )}
    </Svg>
  );
}
