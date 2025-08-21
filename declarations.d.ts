declare module '*.svg' {
  import { CustomSvgProps } from './utils/CustomSvgProps';

  const content: React.FC<CustomSvgProps>;
  export default content;
}
