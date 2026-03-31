// Frontend logic goes here
document.addEventListener("DOMContentLoaded", () => {
    // Optional UI interactions
    const flashMessages = document.querySelectorAll('.flash');
    
    // Auto-hide flash messages after 5 seconds
    if(flashMessages.length > 0) {
        setTimeout(() => {
            flashMessages.forEach(msg => {
                msg.style.transition = "opacity 0.5s ease";
                msg.style.opacity = "0";
                setTimeout(() => msg.remove(), 500);
            });
        }, 5000);
    }
});
