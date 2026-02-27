CREATE DATABASE IF NOT EXISTS namespoter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS keycloak CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

GRANT ALL ON namespoter.* TO 'admin'@'%';
GRANT ALL ON keycloak.* TO 'admin'@'%';

FLUSH PRIVILEGES;
