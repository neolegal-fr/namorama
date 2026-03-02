import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';

export const adminGuard: CanActivateFn = async () => {
  const keycloak = inject(KeycloakService);
  const router = inject(Router);

  const loggedIn = await keycloak.isLoggedIn();
  if (!loggedIn || !keycloak.isUserInRole('admin')) {
    router.navigate(['/']);
    return false;
  }
  return true;
};
