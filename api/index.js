// auth/index.js
const authRouter = new Vexora.RouteController();

// A. Map HTTP methods to specific controller script files
authRouter.get('/profile', 'profile');        // Maps GET /auth/profile -> auth/profile.js
authRouter.post('/login', 'login');          // Maps POST /auth/login -> auth/login.js

// B. Match multiple HTTP verbs
authRouter.match(['GET', 'POST'], '/register', 'register'); // Maps to auth/register.js

// C. Dynamic Parameters Mapping
authRouter.get('/users/:id', 'view_user');   // Maps GET /auth/users/:id -> auth/view_user.js

// D. Catch-all routing handler
authRouter.any('/:any', (req, res) => {
    return res.error("Action not found!", 404);
});

export default authRouter;