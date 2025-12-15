document.addEventListener('DOMContentLoaded', async function() {
    const bonusPopup = document.getElementById('bonus-popup');
    const userBalance = document.getElementById('user-balance');
    const productGrid = document.getElementById('product-grid');

    async function fetchProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) {
                throw new Error('Failed to fetch products');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }

    async function renderProducts() {
        const products = await fetchProducts();
        productGrid.innerHTML = '';

        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.setAttribute('data-id', product.id);
            productCard.setAttribute('data-price', product.price);

            productCard.innerHTML = `
                <img src="/static/images/${product.image}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p class="price">${product.price}</p>
                <button class="btn add-to-cart">Add to Cargo</button>
            `;

            productGrid.appendChild(productCard);
        });

        document.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', function() {
                const productCard = button.closest('.product-card');
                const id = productCard.getAttribute('data-id');
                const name = productCard.querySelector('h3').textContent;
                const price = parseInt(productCard.getAttribute('data-price'), 10);

                if (cart[id]) {
                    cart[id].quantity += 1;
                } else {
                    cart[id] = {
                        id: id,
                        name: name,
                        price: price,
                        quantity: 1
                    };
                }

                localStorage.setItem('cart', JSON.stringify(cart));
                updateCartCount();
            });
        });
    }

    await renderProducts();

    try {
        const response = await fetch('/api/session');
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Session check failed');
        }
        const sessionData = await response.json();
        userBalance.textContent = sessionData.balance;
        if (!sessionData.bonus_received) {
            bonusPopup.style.display = 'flex';
        }
    } catch (error) {
        console.error('Session check failed:', error);
    }


    const bonusForm = document.getElementById('bonus-form');
    const bonusAmount = document.getElementById('bonus-amount');
    const cartModal = document.getElementById('cart-modal');
    const cartButton = document.getElementById('cart-button');
    const closeCartBtn = document.querySelector('.close');
    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const totalAmount = document.getElementById('total-amount');
    const checkoutButton = document.getElementById('checkout-button');
    const addToCartButtons = document.querySelectorAll('.add-to-cart');
    const logoutButton = document.getElementById('logout-button');
    
    const hasSession = document.cookie.includes('session_id');
    
    let cart = JSON.parse(localStorage.getItem('cart')) || {};
    
    function updateCartCount() {
        const count = Object.values(cart).reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = count;
        return count;
    }
    
    function updateCheckoutButton() {
        const total = calculateTotal();
        const balance = userBalance.textContent;
        
        checkoutButton.disabled = (updateCartCount() === 0 || balance < total);
    }
    
    function calculateTotal() {
        let total = 0;
        for (const id in cart) {
            total += cart[id].price * cart[id].quantity;
        }
        totalAmount.textContent = total;
        return total;
    }
    
    function updateCartDisplay() {
        cartItems.innerHTML = '';
        
        if (Object.keys(cart).length === 0) {
            cartItems.innerHTML = '<p>Your cargo hold is empty.</p>';
        } else {
            for (const id in cart) {
                const item = cart[id];
                const cartItemDiv = document.createElement('div');
                cartItemDiv.className = 'cart-item';
                cartItemDiv.innerHTML = `
                    <div>
                        <h4>${item.name}</h4>
                        <p>$${item.price} x ${item.quantity}</p>
                    </div>
                    <div>
                        <button class="btn decrease-item" data-id="${id}">-</button>
                        <span>${item.quantity}</span>
                        <button class="btn increase-item" data-id="${id}">+</button>
                        <button class="btn remove-item" data-id="${id}">🗑️</button>
                    </div>
                `;
                cartItems.appendChild(cartItemDiv);
            }
            
            document.querySelectorAll('.decrease-item').forEach(btn => {
                btn.addEventListener('click', decreaseItemQuantity);
            });
            
            document.querySelectorAll('.increase-item').forEach(btn => {
                btn.addEventListener('click', increaseItemQuantity);
            });
            
            document.querySelectorAll('.remove-item').forEach(btn => {
                btn.addEventListener('click', removeCartItem);
            });
        }
        
        calculateTotal();
        updateCheckoutButton();
    }
    
    function decreaseItemQuantity(e) {
        const id = e.target.getAttribute('data-id');
        if (cart[id].quantity > 1) {
            cart[id].quantity -= 1;
        } else {
            delete cart[id];
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartDisplay();
        updateCartCount();
    }
    
    function increaseItemQuantity(e) {
        const id = e.target.getAttribute('data-id');
        cart[id].quantity += 1;
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartDisplay();
        updateCartCount();
    }
    
    function removeCartItem(e) {
        const id = e.target.getAttribute('data-id');
        delete cart[id];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartDisplay();
        updateCartCount();
    }
    
    
    bonusForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const amount = bonusAmount.value;
        
        if (!amount) {
            alert('Please enter a valid bonus amount between 1 and 999.');
            return;
        }
        
        try {
            const response = await fetch('/api/apply-bonus', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ bonus_amount: amount })
            });
            
            const data = await response.json();
            
            if (data.success) {
                userBalance.textContent = data.balance;
                
                bonusPopup.style.display = 'none';
                
                updateCheckoutButton();
            } else {
                alert('Error applying bonus. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        }
    });
    
    cartButton.addEventListener('click', function() {
        updateCartDisplay();
        cartModal.style.display = 'flex';
    });
    
    closeCartBtn.addEventListener('click', function() {
        cartModal.style.display = 'none';
    });
    
    window.addEventListener('click', function(e) {
        if (e.target === cartModal) {
            cartModal.style.display = 'none';
        }
    });
    
    document.getElementById('checkout-button').addEventListener('click', function() {
        const checkoutModal = document.getElementById('checkout-success-modal');

        document.getElementById('cart-items').innerHTML = '';
        document.getElementById('total-amount').textContent = '0';
        this.disabled = true;
        updateCartDisplay();
    });

    document.getElementById('close-success-modal').addEventListener('click', function() {
        document.getElementById('checkout-success-modal').style.display = 'none';
    });

    checkoutButton.addEventListener('click', async function() {
        const items = [];
        for (const id in cart) {
            items.push({
                product_id: parseInt(id, 10),
                quantity: cart[id].quantity
            });
        }
        
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ items: items })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Checkout failed');
            }

            const data = await response.json();
            
            if (data.success) {
                userBalance.textContent = data.balance;
                
                cart = {};
                localStorage.removeItem('cart');
                
                updateCartCount();
                
                const checkoutModal = document.getElementById('checkout-success-modal');
                const modalContent = checkoutModal.querySelector('.modal-content');
                
                cartModal.style.display = 'none';

                if (data.flag) {
                    modalContent.innerHTML = `
                        <h2>Voyage Provisioned!</h2>
                        <p>Your seafaring supplies are ready!</p>
                        <p><strong>Flag:</strong> ${data.flag}</p>
                        <button id="close-success-modal" class="btn">Close</button>
                    `;
                }
                
                checkoutModal.style.display = 'flex';

                checkoutModal.querySelector('#close-success-modal').addEventListener('click', function() {
                    checkoutModal.style.display = 'none';
                });
            } else {
                alert('Error processing order. Please check your balance and try again.');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            
            if (error.message === 'No active session') {
                alert('Your session has expired. Please refresh the page.');
                window.location.reload();
            } else if (error.message === 'Insufficient balance') {
                alert('Insufficient balance. Please add more funds.');
            } else {
                alert('Checkout failed: ' + error.message);
            }
        }
    });
    
    logoutButton.addEventListener('click', async function() {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                window.location.href = '/';
            } else {
                alert('Logout failed. Please try again.');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('An error occurred during logout.');
        }
    });
    
    updateCartCount();

    const sessionIdElement = document.getElementById('session-id');
    const sessionIdCookie = document.cookie.split('; ').find(row => row.startsWith('session_id='));
    if (sessionIdCookie) {
        const sessionId = sessionIdCookie.split('=')[1];
        sessionIdElement.textContent = sessionId.slice(-8);
    }
});
