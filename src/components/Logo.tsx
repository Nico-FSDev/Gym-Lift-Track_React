import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export default function Logo({ className = '', size = '100%' }: LogoProps) {
  return (
    <img
      src="/Gym-Lift-Track_Icon.png"
      alt="Gym Lift Track Logo"
      style={{ width: size, height: size }}
      className={`${className} object-contain`}
      referrerPolicy="no-referrer"
    />
  );
}
