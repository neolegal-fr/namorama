import { TestBed } from '@angular/core/testing';

import { Domain } from './domain';

describe('Domain', () => {
  let service: Domain;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Domain);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
