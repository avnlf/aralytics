
document.addEventListener("DOMContentLoaded", () => {

    // Supabase connection
    const supabase = window.supabaseClient;

    // Forms
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    // Page elements
    const authTitle = document.getElementById("authTitle");
    const authDescription = document.getElementById("authDescription");
    const authMessage = document.getElementById("authMessage");

    const loginSwitcher = document.getElementById("loginSwitcher");
    const registerSwitcher = document.getElementById("registerSwitcher");

    const showRegister = document.getElementById("showRegister");
    const showLogin = document.getElementById("showLogin");

    // Switch to registration view
    showRegister.addEventListener("click", (event) => {
        event.preventDefault();

        loginForm.hidden = true;
        registerForm.hidden = false;

        loginSwitcher.hidden = true;
        registerSwitcher.hidden = false;

        authTitle.textContent = "Create Your Account";
        authDescription.textContent =
            "Start tracking your academic progress with Aralytics.";

        authMessage.textContent = "";
    });

    // Switch to login view
    showLogin.addEventListener("click", (event) => {
        event.preventDefault();

        registerForm.hidden = true;
        loginForm.hidden = false;

        registerSwitcher.hidden = true;
        loginSwitcher.hidden = false;

        authTitle.textContent = "Welcome to Aralytics!";
        authDescription.textContent =
            "Your academic journey starts here.";

        authMessage.textContent = "";
    });

    // LOGIN
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        const loginButton = loginForm.querySelector("button");

        loginButton.disabled = true;
        loginButton.textContent = "Logging in...";
        authMessage.textContent = "";

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            // Check whether the student has completed profile setup
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("grade_level")
                .eq("id", data.user.id)
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            if (!profile || profile.grade_level === null) {
                window.location.href = "profile.html";
            } else {
                window.location.href = "dashboard.html";
            }

        } catch (error) {
            authMessage.textContent =
                error.message || "Unable to log in. Please try again.";

        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "Log In";
        }
    });

    // CREATE ACCOUNT
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = document.getElementById("fullName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const password = document.getElementById("registerPassword").value;
        const confirmPassword =
            document.getElementById("confirmPassword").value;

        const registerButton = registerForm.querySelector("button");

        if (password !== confirmPassword) {
            authMessage.textContent = "Passwords do not match.";
            return;
        }

        if (password.length < 8) {
            authMessage.textContent =
                "Your password must contain at least 8 characters.";
            return;
        }

        registerButton.disabled = true;
        registerButton.textContent = "Creating account...";
        authMessage.textContent = "";

        try {
            const redirectURL = new URL(
                "login.html",
                window.location.href
            ).href;

            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName
                    },
                    emailRedirectTo: redirectURL
                }
            });

            if (error) {
                throw error;
            }

            // If email confirmation is disabled
            if (data.session) {
                window.location.href = "profile.html";
                return;
            }

            // If email confirmation is required
            authMessage.textContent =
                "Account created! Please check your email to verify your account before logging in.";

            registerForm.reset();

        } catch (error) {
            authMessage.textContent =
                error.message || "Unable to create your account.";

        } finally {
            registerButton.disabled = false;
            registerButton.textContent = "Create Account";
        }
    });

    // Check Supabase initialization
    if (!supabase) {
        authMessage.textContent =
            "Unable to connect to Aralytics. Please refresh the page.";
    }

});
