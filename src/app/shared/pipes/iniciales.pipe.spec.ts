import { InicialesPipe } from './iniciales.pipe';

describe('InicialesPipe', () => {
  let pipe: InicialesPipe;

  beforeEach(() => {
    pipe = new InicialesPipe();
  });

  it('returns initials from nombre and apellidos', () => {
    expect(pipe.transform('Juan', 'García Ruiz')).toBe('JG');
  });

  it('handles single word apellidos', () => {
    expect(pipe.transform('Ana', 'López')).toBe('AL');
  });

  it('handles empty strings gracefully', () => {
    expect(pipe.transform('', '')).toBe('?');
  });

  it('uppercases the initials', () => {
    expect(pipe.transform('carlos', 'ruiz')).toBe('CR');
  });
});
