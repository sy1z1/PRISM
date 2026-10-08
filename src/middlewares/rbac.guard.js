export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user.role;

    console.log("Here is the user payload from the token:", req.user);

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: `Forbidden: Requires one of the following roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
};