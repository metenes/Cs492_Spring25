# Sentio Manual Login Test Results

**Tested on:** [Iphone 12]  
**Date:** [2025-05-01]  
**Tested by:** [Doğa Özdemir]

---

## ✅ Manual Test Cases

| #  | Test Case                             | Steps                                                                 | Expected Result                                | Actual Result | Pass/Fail |
|----|----------------------------------------|-----------------------------------------------------------------------|------------------------------------------------|---------------|-----------|
| 1  | Valid login                            | Enter valid email & password, tap "Login"                            | Redirect to home screen                        |               |           |
| 2  | Invalid password                       | Enter valid email but wrong password, tap "Login"                    | Show "Invalid credentials" message             |               |           |
| 3  | Non-existent user                      | Enter unregistered email, any password, tap "Login"                  | Show "User not found" or generic error message |               |           |
| 4  | Empty email                            | Leave email empty, fill password, tap "Login"                        | Show "Email required" message                  |               |           |
| 5  | Empty password                         | Fill email, leave password empty, tap "Login"                        | Show "Password required" message               |               |           |
| 6  | Both fields empty                      | Leave both email and password empty, tap "Login"                     | Show validation error messages                 |               |           |
| 7  | Invalid email format (no @)            | Enter email without '@', fill password, tap "Login"                  | Show "Invalid email format"                    |               |           |
| 8  | UI responds to loading state           | Tap "Login" with valid info                                          | Button shows loading indicator (if applicable) |               |           |
| 9  | Can re-attempt login after failure     | Enter wrong info, see error, correct and try again                   | Able to try again and log in                   |               |           |

---

## 📝 Notes

- App version tested: [e.g. Expo Go 2.29]
- Backend server: [Localhost / Deployed URL]
- Screenshots attached: [Yes/No]
- Issues encountered: [List if any]
