import { describe, expect, it } from 'vitest';
import { textContoursEps, assertSafeTextEps } from './textEps';
describe('outlined text EPS', () => {
  it('exports contours with a hole as vector paths at physical size', () => {
    const pixels = new Uint8ClampedArray(3*3*4); for(let i=3;i<pixels.length;i+=4) pixels[i]=255; pixels[4*4+3]=0;
    const eps=textContoursEps(pixels,3,3,'#ff0000',25.4,25.4);
    expect(eps).toContain('%%BoundingBox: 0 0 72 72'); expect(eps.match(/moveto/g)).toHaveLength(2); expect(eps).toContain('1 0 0 setrgbcolor'); expect(eps).not.toMatch(/colorimage|imagemask/); expect(()=>assertSafeTextEps(eps)).not.toThrow();
    expect(()=>assertSafeTextEps(eps.replace('eofill','(secret) file'))).toThrow('vector paths');
  });
  it('rejects invisible text and retains low-opacity text outlines',()=>{
    expect(()=>textContoursEps(new Uint8ClampedArray(4),1,1,'#ffffff',1,1)).toThrow('empty');
    expect(textContoursEps(new Uint8ClampedArray([0,0,0,30]),1,1,'#000000',1,1)).toContain('moveto');
  });
});
