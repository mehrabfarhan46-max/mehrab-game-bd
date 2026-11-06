const permissions = Object.freeze({
  superadmin: ['*'],

  admin: [
    'dashboard:view',
    'orders:view',
    'orders:update',
    'tournaments:view',
    'tournaments:manage',
    'packages:view',
    'packages:manage',
    'likes:view',
    'likes:manage',
    'payments:view',
    'payments:manage',
    'users:view'
  ],

  support: [
    'dashboard:view',
    'orders:view',
    'orders:update',
    'tournaments:view',
    'payments:view',
    'likes:view'
  ]
});

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.admin || !req.admin.id || !req.admin.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (
      typeof permission !== 'string' ||
      permission.trim().length === 0
    ) {
      return res.status(500).json({
        success: false,
        message: 'Permission configuration error.'
      });
    }

    const rolePermissions = permissions[req.admin.role] || [];

    if (
      rolePermissions.includes('*') ||
      rolePermissions.includes(permission)
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action.'
    });
  };
}