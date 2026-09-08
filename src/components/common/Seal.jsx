import sealImage from '../../assets/lspu-seal.png';

const SIZES = {
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-28 w-28',
  xl: 'h-40 w-40',
};

export function Seal({ size = 'md', className = '', animated = false }) {
  return (
    <img
      src={sealImage}
      alt="Laguna State Polytechnic University – Los Baños Campus official seal"
      className={`${SIZES[size]} ${animated ? 'animate-seal-in' : ''} ${className}`}
      draggable={false}
    />
  );
}
