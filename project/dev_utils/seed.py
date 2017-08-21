import requests
from IPython import embed

def post_image(name, url):
    data = {
        'name': name,
        'url': url 
        }
    r = requests.post('http://127.0.0.1:5000/api/image', json=data)
    print r.text

def perform_uploads():
    post_image("test_image_1", "http://i.imgur.com/oqxLnYd.jpg")
    post_image("test_image_2", "https://imgur.com/59o1mQo.jpg")
    post_image("test_image_3", "http://i.imgur.com/JIo8v6D.jpg")
    post_image("test_image_4", "http://i.imgur.com/p8mod70.jpg")
    post_image("test_image_5", "https://i.imgur.com/Z7hOph3.jpg")

def get_images():
    r = requests.get('http://127.0.0.1:5000/api/images')
    print r.text

def post_user(username, password):
    data = {
        'username': username,
        'password': password 
        }
    r = requests.post('http://127.0.0.1:5000/api/users', json=data)
    print r.text    

def get_users():
    r = requests.get('http://127.0.0.1:5000/api/users')
    print r.text    


# post_user('test', 'test')
# get_users()

# perform_uploads()
# get_images()
