import React, { Component }  from 'react';


class Nav extends Component {  

    constructor(props){
    super(props);
    // this.testGet();
    };

    render(){
    return (
        <nav id="mainNav" className="navbar navbar-default navbar-fixed-top navbar-custom">
        <div className="container">
            <div className="navbar-header page-scroll">
            <button type="button" className="navbar-toggle" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1">
                <span className="sr-only">Toggle navigation</span> Menu <i className="fa fa-bars" />
            </button>
            <a className="navbar-brand" href="/">Imgrab</a>
            </div>
            <div className="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
            <ul className="nav navbar-nav navbar-right">
                <li className="hidden">
                <a href="#page-top" />
                </li>
                <li className="page-scroll">
                <a href="/images">My Images</a>
                </li>
                <li className="page-scroll">
                <a href="#">Help</a>
                </li>
                <li className="page-scroll">
                <a href="#">Contact</a>
                </li>
            </ul>
            </div>
        </div>
        </nav>
    );
    };

    // testGet() {
    // axios.get('http://127.0.0.1:5000/api/images')
    // .then(function (response) {
    //     console.log(response);
    // })
    // .catch(function (error) {
    //     console.log(error);
    // });
    // }

};

export default Nav
