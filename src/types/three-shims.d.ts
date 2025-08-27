declare module 'three' {
  const content: any;
  export = content;
}

declare module 'three/examples/jsm/loaders/SVGLoader' {
  export class SVGLoader {
    parse(svgText: string): any;
  }
}
